'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  rehearsalVoteBallots,
  rehearsalVoteOptions,
  rehearsalVotes,
  rehearsals,
  songs,
} from '@/lib/db/schema';
import { requireMembership, requireOrgAdmin } from '@/lib/org';
import { confirmVoteNow } from '@/lib/matching/close';
import { slotToDate } from '@/lib/matching/slots';
import { enqueueOutbox } from '@/lib/outbox';
import { outboxSummon } from '@/lib/messages';
import { assertSongActive } from '@/lib/archive';

async function songOrg(songId: string) {
  const [s] = await db
    .select({ orgId: songs.orgId })
    .from(songs)
    .where(eq(songs.id, songId));
  if (!s) throw new Error('곡을 찾을 수 없습니다.');
  return s.orgId;
}

/**
 * 추천 슬롯들로 투표 생성(운영진).
 * rehearsal(status='voting') + rehearsal_votes(마감) + options(후보 슬롯들).
 * picks = ['<slot>:<durationHours>', ...], closeAt = datetime-local 문자열.
 */
export async function createVote(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const closeAt = String(formData.get('closeAt') ?? '').trim();
  const picks = formData.getAll('pick').map(String).filter(Boolean);

  if (picks.length === 0) throw new Error('후보 슬롯을 하나 이상 선택하세요.');
  if (!closeAt) throw new Error('투표 마감 시각을 정하세요.');

  const orgId = await songOrg(songId);
  await requireOrgAdmin(orgId);
  await assertSongActive(songId);

  const parsed = picks.map((p) => {
    const [slotStr, durStr] = p.split(':');
    const slot = Number(slotStr);
    const durHours = Number(durStr);
    if (!Number.isInteger(slot) || !Number.isInteger(durHours) || durHours <= 0) {
      throw new Error('잘못된 슬롯 형식입니다.');
    }
    return { slotStart: slotToDate(slot), durationMin: durHours * 60 };
  });
  parsed.sort((a, b) => a.slotStart.getTime() - b.slotStart.getTime());

  await db.transaction(async (tx) => {
    const [reh] = await tx
      .insert(rehearsals)
      .values({
        orgId,
        songId,
        startAt: parsed[0].slotStart, // 확정 전 임시(마감 시 승자 슬롯으로 갱신).
        durationMin: parsed[0].durationMin,
        status: 'voting',
      })
      .returning({ id: rehearsals.id });
    const [vote] = await tx
      .insert(rehearsalVotes)
      .values({ rehearsalId: reh.id, voteCloseAt: new Date(closeAt) })
      .returning({ id: rehearsalVotes.id });
    await tx.insert(rehearsalVoteOptions).values(
      parsed.map((p) => ({
        voteId: vote.id,
        slotStart: p.slotStart,
        durationMin: p.durationMin,
      })),
    );
  });

  revalidatePath(`/match/${songId}`);
}

/**
 * 랭크 투표 제출(멤버). 본인 표를 통째로 교체.
 * formData: voteId, songId, rank_<optionId> = '' | '1' | '2' | '3'.
 */
export async function castBallot(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const voteId = String(formData.get('voteId') ?? '');
  const orgId = await songOrg(songId);
  const { userId } = await requireMembership(orgId);
  await assertSongActive(songId);

  // 이 투표의 옵션만 허용.
  const options = await db
    .select({ id: rehearsalVoteOptions.id })
    .from(rehearsalVoteOptions)
    .where(eq(rehearsalVoteOptions.voteId, voteId));
  const optionIds = new Set(options.map((o) => o.id));

  const ballots: { optionId: string; userId: string; rank: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('rank_')) continue;
    const optionId = key.slice('rank_'.length);
    if (!optionIds.has(optionId)) continue;
    const rank = Number(String(value));
    if (rank === 1 || rank === 2 || rank === 3) {
      ballots.push({ optionId, userId, rank });
    }
  }

  await db.transaction(async (tx) => {
    if (optionIds.size) {
      await tx
        .delete(rehearsalVoteBallots)
        .where(
          and(
            eq(rehearsalVoteBallots.userId, userId),
            inArray(rehearsalVoteBallots.optionId, [...optionIds]),
          ),
        );
    }
    if (ballots.length) await tx.insert(rehearsalVoteBallots).values(ballots);
  });

  revalidatePath(`/match/${songId}`);
}

/**
 * 소집 메시지 전송(운영진) — 확정 합주를 단톡 아웃박스에 적재(봇이 게시).
 * 절대 딥링크 포함. 봇 미설정이어도 아웃박스에 쌓이고, 화면에서 복붙도 가능.
 */
export async function summon(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const rehearsalId = String(formData.get('rehearsalId') ?? '');
  const orgId = await songOrg(songId);
  await requireOrgAdmin(orgId);
  await assertSongActive(songId); // 아카이브된 공연은 소집(아웃박스 쓰기)도 차단.

  const [reh] = await db
    .select({
      startAt: rehearsals.startAt,
      durationMin: rehearsals.durationMin,
      status: rehearsals.status,
    })
    .from(rehearsals)
    .where(and(eq(rehearsals.id, rehearsalId), eq(rehearsals.orgId, orgId)));
  if (!reh || reh.status !== 'confirmed') throw new Error('확정된 합주가 아닙니다.');
  const [song] = await db.select({ title: songs.title }).from(songs).where(eq(songs.id, songId));

  // 절대 URL: 신뢰 가능한 APP_URL 우선, 없으면 요청 host(프록시 환경 한정).
  const h = await headers();
  const base =
    process.env.APP_URL ??
    `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`;
  const link = `${base}/match/${songId}`;

  await db.transaction(async (tx) => {
    await enqueueOutbox(tx, orgId, outboxSummon(song.title, reh.startAt, reh.durationMin, link));
  });
  revalidatePath(`/match/${songId}`);
}

/**
 * 투표 즉시 확정(운영진) — 마감 전이라도 현재 표로 집계해 확정/충돌 처리.
 * cron 마감과 동일 로직·동일 락을 쓰므로 더블부킹 없이 안전.
 */
export async function confirmVote(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const rehearsalId = String(formData.get('rehearsalId') ?? '');
  const orgId = await songOrg(songId);
  await requireOrgAdmin(orgId);
  await assertSongActive(songId);

  const res = await confirmVoteNow(rehearsalId, orgId);
  if (res.outcome === 'notfound') throw new Error('진행 중인 투표가 아닙니다.');
  revalidatePath(`/match/${songId}`);
}

/** 투표 취소(운영진) — 합주/투표/옵션/표 전부 삭제(cascade). */
export async function cancelVote(formData: FormData) {
  const songId = String(formData.get('songId') ?? '');
  const rehearsalId = String(formData.get('rehearsalId') ?? '');
  const orgId = await songOrg(songId);
  await requireOrgAdmin(orgId);
  await assertSongActive(songId);
  await db
    .delete(rehearsals)
    .where(and(eq(rehearsals.id, rehearsalId), eq(rehearsals.orgId, orgId)));
  revalidatePath(`/match/${songId}`);
}
