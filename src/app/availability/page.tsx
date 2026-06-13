import { and, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { availabilityException, availabilityTemplate } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { AvailabilityGrid } from './AvailabilityGrid';
import { ExceptionEditor } from './ExceptionEditor';

export default async function AvailabilityPage() {
  const user = await requireUser();
  const { active, all } = await requireActiveOrg();

  const templateRows = await db
    .select({
      weekday: availabilityTemplate.weekday,
      hour: availabilityTemplate.hour,
      tier: availabilityTemplate.tier,
    })
    .from(availabilityTemplate)
    .where(
      and(
        eq(availabilityTemplate.userId, user.id),
        eq(availabilityTemplate.orgId, active.orgId),
      ),
    );

  const exceptionRows = await db
    .select({
      date: availabilityException.date,
      hour: availabilityException.hour,
      tier: availabilityException.tier,
    })
    .from(availabilityException)
    .where(
      and(
        eq(availabilityException.userId, user.id),
        eq(availabilityException.orgId, active.orgId),
      ),
    );

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <div>
          <h1 className="text-lg font-bold">가용성</h1>
          <p className="text-sm text-gray-500">
            합주·회의 매칭에 쓰이는 가능 시간입니다. 한 번 칠하면 {active.orgName}의 모든
            팀·곡 매칭에 공유됩니다.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">주간 반복 (기본)</h2>
          <AvailabilityGrid orgId={active.orgId} initial={templateRows} />
        </section>

        <hr className="border-gray-100" />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">날짜별 예외</h2>
          <p className="text-xs text-gray-500">
            특정 날짜만 다르면 여기서 덮어쓰세요 (예: 시험 기간, 공연 전날).
          </p>
          <ExceptionEditor
            orgId={active.orgId}
            template={templateRows}
            initial={exceptionRows}
          />
        </section>
      </main>
    </>
  );
}
