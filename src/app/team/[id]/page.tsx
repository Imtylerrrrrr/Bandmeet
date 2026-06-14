import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { Button, ButtonLink } from '@/components/Button';
import { db } from '@/lib/db';
import {
  memberships,
  performances,
  profiles,
  songs,
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import {
  addTeamMember,
  createSong,
  deleteSong,
  removeTeamMember,
  setSongStatus,
} from './actions';

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const [team] = await db.select().from(teams).where(eq(teams.id, id));
  if (!team || team.orgId !== active.orgId) notFound();

  const [perf] = await db
    .select({
      id: performances.id,
      name: performances.name,
      archivedAt: performances.archivedAt,
    })
    .from(performances)
    .where(eq(performances.id, team.performanceId));
  const archived = !!perf?.archivedAt;

  // org 전체 멤버(이름) — 팀원 표시 + 추가 후보 산출에 재사용.
  const orgMembers = await db
    .select({ userId: memberships.userId, name: profiles.name })
    .from(memberships)
    .innerJoin(profiles, eq(memberships.userId, profiles.id))
    .where(eq(memberships.orgId, active.orgId))
    .orderBy(asc(profiles.name));

  const teamMemberIds = new Set(
    (
      await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, id))
    ).map((r) => r.userId),
  );
  const members = orgMembers.filter((m) => teamMemberIds.has(m.userId));
  const candidates = orgMembers.filter((m) => !teamMemberIds.has(m.userId));

  const songRows = await db
    .select()
    .from(songs)
    .where(eq(songs.teamId, id))
    .orderBy(asc(songs.status), asc(songs.title));

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-6">
        <div>
          {perf && (
            <Link
              href={`/perf/${perf.id}`}
              className="text-xs text-mut hover:underline"
            >
              ← {perf.name}
            </Link>
          )}
          <h1 className="mt-1 text-[19px] font-semibold tracking-tight">{team.name}</h1>
        </div>

        {archived && (
          <p className="rounded-lg border border-line bg-hover p-3 text-sm text-mut">
            🔒 아카이브된 공연의 팀입니다. 읽기 전용입니다.
          </p>
        )}

        {/* 팀원 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">팀원 ({members.length})</h2>
          {members.length === 0 ? (
            <p className="text-sm text-mut">아직 팀원이 없습니다.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                >
                  {m.name}
                  {isAdmin && !archived && (
                    <form action={removeTeamMember}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <button className="text-xs text-danger-text hover:opacity-70">
                        ×
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && !archived && candidates.length > 0 && (
            <form action={addTeamMember} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="teamId" value={team.id} />
              <select
                name="userId"
                className="w-full rounded-lg border bg-surface px-2.5 py-2 text-sm sm:w-auto"
                defaultValue=""
              >
                <option value="" disabled>
                  팀원 추가…
                </option>
                {candidates.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                추가
              </Button>
            </form>
          )}
        </section>

        {/* 곡 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">곡 ({songRows.length})</h2>
            <ButtonLink
              href={`/team/${team.id}/assign`}
              variant="secondary"
              size="sm"
            >
              곡-사람 배치 →
            </ButtonLink>
          </div>

          {isAdmin && !archived && (
            <form action={createSong} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="teamId" value={team.id} />
              <input
                name="title"
                required
                placeholder="곡 제목"
                className="w-full rounded-lg border bg-surface px-3 py-2 text-sm sm:flex-1"
              />
              <Button type="submit" variant="primary">
                추가
              </Button>
            </form>
          )}

          {songRows.length === 0 ? (
            <p className="text-sm text-mut">아직 곡이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {songRows.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">
                    {s.title}
                    <span
                      className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        s.status === 'confirmed'
                          ? 'bg-ok-bg text-ok-text'
                          : 'bg-hover text-mut'
                      }`}
                    >
                      {s.status === 'confirmed' ? '확정' : '후보'}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <ButtonLink href={`/match/${s.id}`} variant="secondary" size="sm">
                      매칭 →
                    </ButtonLink>
                    {isAdmin && !archived && (
                      <div className="flex items-center gap-2">
                        <form action={setSongStatus}>
                          <input type="hidden" name="songId" value={s.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={s.status === 'confirmed' ? 'candidate' : 'confirmed'}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {s.status === 'confirmed' ? '후보로' : '확정으로'}
                          </Button>
                        </form>
                        <form action={deleteSong}>
                          <input type="hidden" name="songId" value={s.id} />
                          <Button type="submit" variant="danger" size="sm">
                            삭제
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
