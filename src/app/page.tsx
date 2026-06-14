import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/AppHeader';
import { WeekGrid } from '@/components/WeekGrid';
import { requireUser } from '@/lib/auth';
import { detectConflicts } from '@/lib/calendar/conflicts';
import { loadPersonalWeek } from '@/lib/calendar/load';
import { getActiveOrg } from '@/lib/org';
import { addDays, kstDateStr, kstWeekday } from '@/lib/matching/slots';

export default async function Home() {
  const ctx = await getActiveOrg();
  if (!ctx) redirect('/onboarding');
  const { active, all } = ctx;
  const user = await requireUser();

  const todayStr = kstDateStr(new Date());
  const weekStart = addDays(todayStr, -kstWeekday(todayStr)); // 이번 주 일요일
  const { bookings } = await loadPersonalWeek(active.orgId, user.id, weekStart);
  const report = detectConflicts(bookings);

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <section>
          <h1 className="text-lg font-bold">{active.orgName}</h1>
          <p className="text-sm text-gray-500">내 이번 주 일정</p>
        </section>

        <WeekGrid weekStart={weekStart} bookings={bookings} report={report} todayStr={todayStr} />
        {bookings.length === 0 && (
          <p className="text-sm text-gray-500">
            이번 주 확정된 합주가 없습니다. 가용성을 입력하면 합주가 매칭됩니다.
          </p>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card href="/calendar" title="캘린더" desc="합주실 일정·충돌 경고" />
          <Card href="/perf" title="공연" desc="공연·팀·곡 배치" />
          <Card href="/availability" title="가용성" desc="가능 시간 입력" />
          <Card href="/members" title="멤버" desc="부원·초대코드" />
        </section>
      </main>
    </>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href}>
      <div className="rounded-lg border p-4 hover:bg-gray-50">
        <div className="font-semibold">{title}</div>
        <div className="mt-1 text-sm text-gray-500">{desc}</div>
      </div>
    </Link>
  );
}
