import { and, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { availabilityTemplate } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { AvailabilityGrid } from './AvailabilityGrid';

export default async function AvailabilityPage() {
  const user = await requireUser();
  const { active, all } = await requireActiveOrg();

  const rows = await db
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

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
        <div>
          <h1 className="text-lg font-bold">가용성 (주간 반복)</h1>
          <p className="text-sm text-gray-500">
            합주·회의 매칭에 쓰이는 가능 시간입니다. 한 번 칠하면 {active.orgName}의 모든
            팀·곡 매칭에 공유됩니다.
          </p>
        </div>
        <AvailabilityGrid orgId={active.orgId} initial={rows} />
      </main>
    </>
  );
}
