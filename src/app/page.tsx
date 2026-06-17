import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  IconCalendarMonth,
  IconClock,
  IconUsers,
  IconChecks,
  IconBrush,
  IconChevronLeft,
  IconChevronRight,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { WeekGrid } from '@/components/WeekGrid';
import { AgendaList } from '@/components/AgendaList';
import { requireUser } from '@/lib/auth';
import { detectConflicts } from '@/lib/calendar/conflicts';
import { loadPersonalWeek } from '@/lib/calendar/load';
import { loadHomeStats } from '@/lib/home/load';
import { getActiveOrg } from '@/lib/org';
import {
  addDays,
  dateHourToSlot,
  isValidDate,
  kstDateStr,
  kstWeekday,
} from '@/lib/matching/slots';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await getActiveOrg();
  if (!ctx) redirect('/onboarding');
  const { active, all } = ctx;
  const user = await requireUser();
  const sp = await searchParams;

  const todayStr = kstDateStr(new Date());
  // ?week= 기준일(무효면 오늘) → 그 주 일요일. 없으면 이번 주.
  const base = sp.week && isValidDate(sp.week) ? sp.week : todayStr;
  const weekStart = addDays(base, -kstWeekday(base));
  const thisWeekStart = addDays(todayStr, -kstWeekday(todayStr));
  const isThisWeek = weekStart === thisWeekStart;
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const [{ bookings }, stats] = await Promise.all([
    loadPersonalWeek(active.orgId, user.id, weekStart),
    loadHomeStats(active.orgId, user.id),
  ]);
  const report = detectConflicts(bookings);

  // 다음 합주까지 남은 일수(KST 자정 기준).
  const dDay = stats.next
    ? Math.round(
        (dateHourToSlot(kstDateStr(stats.next.startAt), 0) -
          dateHourToSlot(todayStr, 0)) /
          24,
      )
    : null;
  const nextLabel = dDay === null ? '없음' : dDay <= 0 ? '오늘' : `D-${dDay}`;

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-2">
          <h1 className="text-[19px] font-semibold tracking-tight">{active.orgName}</h1>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium tabular-nums text-mut">
              {isThisWeek ? '내 이번 주 일정' : `${weekStart} ~ ${addDays(weekStart, 6)}`}
            </p>
            <div className="flex items-center gap-1">
              <Link
                href={`/?week=${prevWeek}`}
                aria-label="이전 주"
                className="flex h-9 w-9 items-center justify-center rounded-lg border text-mut transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                <IconChevronLeft size={17} stroke={1.5} />
              </Link>
              <Link
                href="/"
                className="rounded-lg border px-3 py-1.5 text-[13px] font-medium text-mut transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                이번 주
              </Link>
              <Link
                href={`/?week=${nextWeek}`}
                aria-label="다음 주"
                className="flex h-9 w-9 items-center justify-center rounded-lg border text-mut transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                <IconChevronRight size={17} stroke={1.5} />
              </Link>
              <Link
                href="/calendar?view=month"
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-primary-soft"
              >
                <IconCalendarMonth size={15} stroke={1.5} />
                월별
              </Link>
            </div>
          </div>
        </section>

        {/* 데스크탑: 주간 격자 / 모바일: 일정 리스트 */}
        <div className="hidden sm:block">
          <WeekGrid weekStart={weekStart} bookings={bookings} report={report} todayStr={todayStr} />
        </div>
        {bookings.length > 0 && (
          <div className="sm:hidden">
            <AgendaList weekStart={weekStart} bookings={bookings} report={report} todayStr={todayStr} />
          </div>
        )}
        {bookings.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-mut">
              {isThisWeek ? '이번 주' : '이 주에'} 확정된 합주가 없어요.
            </p>
            <Link
              href="/availability"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-primary-soft"
            >
              <IconBrush size={15} stroke={1.5} />
              되는 시간을 칠하면 합주가 자동으로 잡혀요
            </Link>
          </div>
        )}

        {/* 다음 행동 — 네비 복제가 아니라 내 상태. */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard href="/availability" label="되는 시간" value="칠하기 →" Icon={IconBrush} accent />
          <StatCard href="/perf" label="투표 대기" value={`${stats.pendingVotes}건`} Icon={IconChecks} dim={stats.pendingVotes === 0} />
          <StatCard href="/calendar" label="다음 합주" value={nextLabel} Icon={IconClock} dim={!stats.next} />
          <StatCard href="/members" label="멤버" value={`${stats.memberCount}명`} Icon={IconUsers} />
        </section>
      </main>
    </>
  );
}

function StatCard({
  href,
  label,
  value,
  Icon,
  accent = false,
  dim = false,
}: {
  href: string;
  label: string;
  value: string;
  Icon: ComponentType<IconProps>;
  accent?: boolean;
  dim?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 rounded-xl border bg-surface p-4 transition-all duration-150 hover:-translate-y-px hover:bg-hover hover:shadow-sm ${
        accent ? 'border-primary/40' : ''
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          accent ? 'bg-primary text-white' : 'bg-primary-soft text-primary'
        }`}
      >
        <Icon size={18} stroke={1.5} />
      </span>
      <div>
        <div className="text-xs text-mut">{label}</div>
        <div
          className={`mt-0.5 text-[15px] font-semibold tabular-nums ${
            dim ? 'text-faint' : 'text-ink'
          }`}
        >
          {value}
        </div>
      </div>
    </Link>
  );
}
