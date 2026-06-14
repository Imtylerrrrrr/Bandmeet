import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { db } from '@/lib/db';
import { performances, teams } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { perfDateLabel } from '@/lib/perf';
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
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
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
          <p className="text-xs tabular-nums text-mut">
            {perfDateLabel(perf.performDate, perf.performEndDate)}
          </p>
          {isAdmin && (
            <form
              action={archived ? unarchivePerformance : archivePerformance}
              className="mt-2"
            >
              <input type="hidden" name="orgId" value={active.orgId} />
              <input type="hidden" name="id" value={perf.id} />
              <Button type="submit" variant="secondary" size="sm">
                {archived ? '아카이브 복원' : '공연 종료(아카이브)'}
              </Button>
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
                className="flex-1 rounded-lg border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:border-line-strong"
              />
              <Button type="submit" variant="primary">
                추가
              </Button>
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
                      <Button type="submit" variant="danger" size="sm">
                        삭제
                      </Button>
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
