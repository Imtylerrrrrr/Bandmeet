import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { db } from '@/lib/db';
import { performances, teams } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { createTeam, deleteTeam } from './actions';

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
          <Link href="/perf" className="text-xs text-gray-500 hover:underline">
            ← 공연 목록
          </Link>
          <h1 className="mt-1 text-lg font-bold">{perf.name}</h1>
          <p className="text-xs text-gray-500">
            {perf.performDate ? `공연일 ${perf.performDate}` : '공연일 미정'}
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">팀 ({teamRows.length})</h2>

          {isAdmin && (
            <form action={createTeam} className="flex gap-2">
              <input type="hidden" name="performanceId" value={perf.id} />
              <input
                name="name"
                required
                placeholder="팀 이름 (예: 보컬밴드 A)"
                className="flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                추가
              </button>
            </form>
          )}

          {teamRows.length === 0 ? (
            <p className="text-sm text-gray-500">아직 팀이 없습니다.</p>
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
                  {isAdmin && (
                    <form action={deleteTeam}>
                      <input type="hidden" name="performanceId" value={perf.id} />
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-xs text-red-600 hover:underline">
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
