import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { CopyButton } from '@/components/CopyButton';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  rehearsalVoteBallots,
  rehearsalVoteOptions,
  rehearsalVotes,
  rehearsals,
  songs,
} from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { recommendSlots } from '@/lib/matching/engine';
import { loadRecommendInput } from '@/lib/matching/load';
import {
  durationToHours,
  fmtSlotRange,
  instantToSlot,
  kstDateStr,
  slotToDate,
} from '@/lib/matching/slots';
import { outboxSummon } from '@/lib/messages';
import { isSongArchived } from '@/lib/archive';
import { cancelVote, castBallot, createVote, summon } from './actions';

const fmtSlot = (slot: number, durMin: number): string =>
  fmtSlotRange(slot, durationToHours(durMin));

export default async function MatchPage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  const user = await requireUser();
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const [song] = await db.select().from(songs).where(eq(songs.id, songId));
  if (!song || song.orgId !== active.orgId) notFound();

  // 진행 중(투표중) 합주가 있으면 투표 화면, 없으면 추천 화면.
  const [reh] = await db
    .select()
    .from(rehearsals)
    .where(and(eq(rehearsals.songId, songId), eq(rehearsals.status, 'voting')))
    .limit(1);

  // 확정된 합주(소집 대상).
  const confirmedRows = await db
    .select({ id: rehearsals.id, startAt: rehearsals.startAt, durationMin: rehearsals.durationMin })
    .from(rehearsals)
    .where(and(eq(rehearsals.songId, songId), eq(rehearsals.status, 'confirmed')))
    .orderBy(asc(rehearsals.startAt));
  const h = await headers();
  const base =
    process.env.APP_URL ??
    `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`;
  const archived = await isSongArchived(songId);

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div>
          <Link href={`/team/${song.teamId}`} className="text-xs text-gray-500 hover:underline">
            ← 팀으로
          </Link>
          <h1 className="mt-1 text-lg font-bold">합주 매칭 · {song.title}</h1>
        </div>

        {archived && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            🔒 아카이브된 공연입니다. 새 투표·확정·소집은 할 수 없습니다(읽기 전용).
          </p>
        )}

        {confirmedRows.length > 0 && (
          <ConfirmedSection
            songId={songId}
            songTitle={song.title}
            rows={confirmedRows}
            isAdmin={isAdmin && !archived}
            link={`${base}/match/${songId}`}
          />
        )}

        {reh ? (
          <VoteSection
            songId={songId}
            rehearsalId={reh.id}
            userId={user.id}
            isAdmin={isAdmin && !archived}
            canVote={!archived}
          />
        ) : (
          <RecommendSection songId={songId} isAdmin={isAdmin && !archived} />
        )}
      </main>
    </>
  );
}

function ConfirmedSection({
  songId,
  songTitle,
  rows,
  isAdmin,
  link,
}: {
  songId: string;
  songTitle: string;
  rows: { id: string; startAt: Date; durationMin: number }[];
  isAdmin: boolean;
  link: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">확정된 합주</h2>
      {rows.map((r) => {
        const msg = outboxSummon(songTitle, r.startAt, r.durationMin, link);
        return (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-3"
          >
            <span className="text-sm font-medium text-green-800">
              {fmtSlot(instantToSlot(r.startAt), r.durationMin)}
            </span>
            <pre className="whitespace-pre-wrap rounded border bg-white p-2 text-xs text-gray-700">
              {msg}
            </pre>
            <div className="flex items-center gap-2">
              <CopyButton text={msg} />
              {isAdmin && (
                <form action={summon}>
                  <input type="hidden" name="songId" value={songId} />
                  <input type="hidden" name="rehearsalId" value={r.id} />
                  <button className="rounded bg-black px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                    단톡 소집 보내기
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

async function RecommendSection({ songId, isAdmin }: { songId: string; isAdmin: boolean }) {
  const loaded = await loadRecommendInput(songId, new Date());
  if (!loaded) notFound();
  const recs = recommendSlots(loaded.input);

  // 마감 기본값: 3일 뒤 18:00 KST (datetime-local 용 'YYYY-MM-DDTHH:mm').
  const close = slotToDate(instantToSlot(new Date()) + 24 * 3 + 8); // +3일 + 8시간 근처
  const defaultClose = `${kstDateStr(close)}T18:00`;

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        담당자 {loaded.members.length}명 ·{' '}
        {loaded.members.map((m) => m.name).join(', ') || '담당자 없음'}
      </p>

      {loaded.members.length === 0 ? (
        <p className="text-sm text-gray-500">
          먼저 곡-사람 배치에서 담당자를 지정하세요.
        </p>
      ) : recs.length === 0 ? (
        <p className="text-sm text-gray-500">
          담당자 전원이 동시에 가능한 시간이 없습니다. 가용성 입력을 확인하세요.
        </p>
      ) : isAdmin ? (
        <form action={createVote} className="flex flex-col gap-3 rounded-lg border p-4">
          <input type="hidden" name="songId" value={songId} />
          <div className="text-sm font-semibold">추천 슬롯 — 투표에 올릴 후보 선택</div>
          <ul className="flex flex-col gap-1">
            {recs.map((r) => (
              <li key={`${r.start}:${r.duration}`}>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input type="checkbox" name="pick" value={`${r.start}:${r.duration}`} />
                  <span className="font-medium">{fmtSlot(r.start, r.duration * 60)}</span>
                  <SlotBadges
                    yellow={r.yellowMembers}
                    continuity={r.continuity}
                    roomAdj={r.roomAdjacency}
                  />
                </label>
              </li>
            ))}
          </ul>
          <label className="flex flex-col text-xs text-gray-500">
            투표 마감
            <input
              type="datetime-local"
              name="closeAt"
              defaultValue={defaultClose}
              className="mt-1 w-fit rounded-md border px-2 py-1 text-sm"
            />
          </label>
          <button className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            투표 만들기
          </button>
        </form>
      ) : (
        <ul className="flex flex-col gap-1">
          {recs.map((r) => (
            <li key={`${r.start}:${r.duration}`} className="flex items-center gap-2 rounded border p-2 text-sm">
              <span className="font-medium">{fmtSlot(r.start, r.duration * 60)}</span>
              <SlotBadges yellow={r.yellowMembers} continuity={r.continuity} roomAdj={r.roomAdjacency} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function VoteSection({
  songId,
  rehearsalId,
  userId,
  isAdmin,
  canVote,
}: {
  songId: string;
  rehearsalId: string;
  userId: string;
  isAdmin: boolean;
  canVote: boolean;
}) {
  const [vote] = await db
    .select()
    .from(rehearsalVotes)
    .where(eq(rehearsalVotes.rehearsalId, rehearsalId));
  if (!vote) notFound();

  const options = await db
    .select()
    .from(rehearsalVoteOptions)
    .where(eq(rehearsalVoteOptions.voteId, vote.id))
    .orderBy(asc(rehearsalVoteOptions.slotStart));
  const optionIds = options.map((o) => o.id);
  const ballots = optionIds.length
    ? await db
        .select()
        .from(rehearsalVoteBallots)
        .where(inArray(rehearsalVoteBallots.optionId, optionIds))
    : [];

  const myRank = new Map<string, number>();
  for (const b of ballots) if (b.userId === userId) myRank.set(b.optionId, b.rank);
  const tally = (optId: string, rank: number) =>
    ballots.filter((b) => b.optionId === optId && b.rank === rank).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          투표 중 · 마감 {vote.voteCloseAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </p>
        {isAdmin && (
          <form action={cancelVote}>
            <input type="hidden" name="songId" value={songId} />
            <input type="hidden" name="rehearsalId" value={rehearsalId} />
            <button className="text-xs text-red-600 hover:underline">투표 취소</button>
          </form>
        )}
      </div>

      <form action={castBallot} className="flex flex-col gap-2">
        <input type="hidden" name="songId" value={songId} />
        <input type="hidden" name="voteId" value={vote.id} />
        <div className="text-sm font-semibold">내 순위 투표 (1·2·3순위)</div>
        <ul className="flex flex-col gap-2">
          {options.map((o) => {
            const slot = instantToSlot(o.slotStart);
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="font-medium">{fmtSlot(slot, o.durationMin)}</span>
                <span className="text-xs text-gray-400">
                  1순위 {tally(o.id, 1)} · 2순위 {tally(o.id, 2)} · 3순위 {tally(o.id, 3)}
                </span>
                {canVote && (
                  <select
                    name={`rank_${o.id}`}
                    defaultValue={String(myRank.get(o.id) ?? '')}
                    className="ml-auto rounded border px-2 py-1 text-sm"
                  >
                    <option value="">—</option>
                    <option value="1">1순위</option>
                    <option value="2">2순위</option>
                    <option value="3">3순위</option>
                  </select>
                )}
              </li>
            );
          })}
        </ul>
        {canVote && (
          <button className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            투표 제출
          </button>
        )}
      </form>

      <p className="text-xs text-gray-400">
        마감 시각이 지나면 매시 자동 집계되어 최다 득표 빈 슬롯으로 확정됩니다.
      </p>
    </section>
  );
}

function SlotBadges({
  yellow,
  continuity,
  roomAdj,
}: {
  yellow: number;
  continuity: number;
  roomAdj: number;
}) {
  return (
    <span className="flex gap-1 text-xs">
      {yellow === 0 ? (
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">전원 가능</span>
      ) : (
        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700">
          되면 {yellow}명
        </span>
      )}
      {continuity > 0 && (
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">이어서 +{continuity}</span>
      )}
      {roomAdj > 0 && (
        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700">방 인접</span>
      )}
    </span>
  );
}
