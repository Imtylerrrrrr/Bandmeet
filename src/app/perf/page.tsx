import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { db } from '@/lib/db';
import { performances } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { createPerformance, deletePerformance } from './actions';

export default async function PerfPage() {
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const rows = await db
    .select()
    .from(performances)
    .where(eq(performances.orgId, active.orgId))
    .orderBy(desc(performances.performDate));

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <h1 className="text-lg font-bold">공연 ({rows.length})</h1>

        {isAdmin && (
          <form
            action={createPerformance}
            className="flex flex-col gap-3 rounded-lg border p-4"
          >
            <input type="hidden" name="orgId" value={active.orgId} />
            <div className="text-sm font-semibold">공연 추가</div>
            <input
              name="name"
              required
              placeholder="공연 이름 (예: 2026 봄 정기공연)"
              className="rounded-md border px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col text-xs text-gray-500">
                공연일
                <input name="performDate" type="date" className="rounded-md border px-2 py-1 text-sm" />
              </label>
              <label className="flex flex-col text-xs text-gray-500">
                투표 마감
                <input
                  name="deadline"
                  type="datetime-local"
                  className="rounded-md border px-2 py-1 text-sm"
                />
              </label>
            </div>
            <button className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              추가
            </button>
          </form>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">아직 공연이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <Link href={`/perf/${p.id}`} className="flex-1 hover:underline">
                  <div className="font-semibold">
                    {p.name}
                    {p.archivedAt && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        아카이브
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {p.performDate ? `공연일 ${p.performDate}` : '공연일 미정'}
                    {p.deadline &&
                      ` · 마감 ${p.deadline.toLocaleString('ko-KR')}`}
                  </div>
                </Link>
                {isAdmin && (
                  <form action={deletePerformance}>
                    <input type="hidden" name="orgId" value={active.orgId} />
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs text-red-600 hover:underline">
                      삭제
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
