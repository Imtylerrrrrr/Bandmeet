import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { IconMicrophone2 } from '@tabler/icons-react';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { db } from '@/lib/db';
import { performances } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { perfDateLabel } from '@/lib/perf';
import {
  archivePerformance,
  createPerformance,
  deletePerformance,
  unarchivePerformance,
} from './actions';

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
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="text-[19px] font-semibold tracking-tight">
          공연 <span className="font-normal text-mut">{rows.length}</span>
        </h1>

        {isAdmin && (
          <form
            action={createPerformance}
            className="flex flex-col gap-3 rounded-xl border bg-surface p-4"
          >
            <input type="hidden" name="orgId" value={active.orgId} />
            <div className="text-[15px] font-semibold">공연 추가</div>
            <input
              name="name"
              required
              placeholder="공연 이름 (예: 2026 봄 정기공연)"
              className="rounded-lg border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:border-line-strong"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex flex-col gap-1 text-xs text-mut">
                공연 시작일
                <input
                  name="performDate"
                  type="date"
                  className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular-nums transition-colors duration-150 hover:border-line-strong sm:w-auto"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-mut">
                종료일 <span className="text-faint">(선택)</span>
                <input
                  name="performEndDate"
                  type="date"
                  className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular-nums transition-colors duration-150 hover:border-line-strong sm:w-auto"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-mut">
                투표 마감
                <input
                  name="deadline"
                  type="datetime-local"
                  className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular-nums transition-colors duration-150 hover:border-line-strong sm:w-auto"
                />
              </label>
            </div>
            <Button type="submit" variant="primary" className="self-start">
              추가
            </Button>
          </form>
        )}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-surface px-4 py-12 text-center sm:px-6">
            <IconMicrophone2 size={26} stroke={1.5} className="text-faint" />
            <p className="text-sm text-mut">아직 공연이 없어요.</p>
            {isAdmin && <p className="text-xs text-faint">위에서 첫 공연을 추가해 보세요.</p>}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border bg-surface p-4 transition-colors duration-150 hover:bg-hover sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/perf/${p.id}`} className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {p.name}
                    {p.archivedAt && (
                      <span className="rounded-md bg-hover px-1.5 py-0.5 text-xs font-medium text-mut">
                        아카이브
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-mut">
                    {perfDateLabel(p.performDate, p.performEndDate)}
                    {p.deadline && ` · 마감 ${p.deadline.toLocaleString('ko-KR')}`}
                  </div>
                </Link>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <form action={p.archivedAt ? unarchivePerformance : archivePerformance}>
                      <input type="hidden" name="orgId" value={active.orgId} />
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {p.archivedAt ? '복원' : '아카이브'}
                      </Button>
                    </form>
                    <form action={deletePerformance}>
                      <input type="hidden" name="orgId" value={active.orgId} />
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="danger" size="sm">
                        삭제
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
