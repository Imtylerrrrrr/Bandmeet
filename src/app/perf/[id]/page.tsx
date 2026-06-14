import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { db } from '@/lib/db';
import { performances, teams } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { createTeam, deleteTeam } from './actions';
import { archivePerformance, unarchivePerformance } from '../actions';

export default async function PerfDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const [perf] = await db
    .select()
    .from(performances)
    .where(eq(performances.id, id));
  if (!perf || perf.orgId !== active.orgId) notFound();
  const archived = !!perf.archivedAt;

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.performanceId, id))
    .orderBy(asc(teams.name));

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div>
          <Link href="/perf" className="text-xs text-mut hover:underline">
            ← 공연 목록
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-[19px] font-semibold tracking-tight">{perf.name}</h1>
            {archived && (
              <span className="rounded bg-hover px-1.5 py-0.5 text-xs text-mut">
                아카이브
              </span>
            )}
          </div>
          <p className="text-xs text-mut">
            {perf.performDate ? `공연일 ${perf.performDate}` : '공연일 미정'}
          </p>
          {isAdmin && (
            <form
              action={archived ? unarchivePerformance : archivePerformance}
              className="mt-2"
            >
              <input type="hidden" name="orgId" value={active.orgId} />
              <input type="hidden" name="id" value={perf.id} />
              <button className="rounded border px-2 py-1 text-xs hover:bg-hover">
                {archived ? '아카이브 복원' : '공연 종료(아카이브)'}
              </button>
            </form>
          )}
        </div>

        {archived && (
          <p className="rounded-lg border border-line bg-hover p-3 text-sm text-mut">
            🔒 아카이브된 공연입니다. 읽기 전용이며 팀·곡·투표를 변경할 수 없습니다.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">팀 ({teamRows.length})</h2>

          {isAdmin && !archived && (
            <form action={createTeam} className="flex gap-2">
              <input type="hidden" name="performanceId" value={perf.id} />
              <input
                name="name"
                required
                placeholder="팀 이름 (예: 보컬밴드 A)"
                className="flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                추가
              </button>
            </form>
          )}

          {teamRows.length === 0 ? (
            <p className="text-sm text-mut">아직 팀이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {teamRows.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <Link href={`/team/${t.id}`} className="flex-1 font-medium hover:underline">
                    {t.name}
                  </Link>
                  {isAdmin && !archived && (
                    <form action={deleteTeam}>
                      <input type="hidden" name="performanceId" value={perf.id} />
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-xs text-danger-text hover:underline">
                        삭제
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
