import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  IconCalendarMonth,
  IconMicrophone2,
  IconClock,
  IconUsers,
  IconBrush,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

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
      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-0.5">
          <h1 className="text-[19px] font-semibold tracking-tight">{active.orgName}</h1>
          <p className="text-sm text-mut">내 이번 주 일정</p>
        </section>

        <WeekGrid weekStart={weekStart} bookings={bookings} report={report} todayStr={todayStr} />
        {bookings.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-mut">이번 주 확정된 합주가 없어요.</p>
            <Link
              href="/availability"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-primary-soft"
            >
              <IconBrush size={15} stroke={1.5} />
              되는 시간을 칠하면 합주가 자동으로 잡혀요
            </Link>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card href="/calendar" title="캘린더" desc="합주실 일정·충돌" Icon={IconCalendarMonth} />
          <Card href="/perf" title="공연" desc="공연·팀·곡 배치" Icon={IconMicrophone2} />
          <Card href="/availability" title="내 시간" desc="되는 시간 칠하기" Icon={IconClock} />
          <Card href="/members" title="멤버" desc="부원·초대코드" Icon={IconUsers} />
        </section>
      </main>
    </>
  );
}

function Card({
  href,
  title,
  desc,
  Icon,
}: {
  href: string;
  title: string;
  desc: string;
  Icon: ComponentType<IconProps>;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border bg-surface p-4 transition-all duration-150 hover:-translate-y-px hover:bg-hover hover:shadow-sm"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon size={18} stroke={1.5} />
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-mut">{desc}</div>
      </div>
    </Link>
  );
}
