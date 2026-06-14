import Link from 'next/link';
import {
  IconChevronLeft,
  IconChevronRight,
  IconAlertTriangle,
  IconBrush,
} from '@tabler/icons-react';

import { AppHeader } from '@/components/AppHeader';
import { WeekGrid } from '@/components/WeekGrid';
import { TimeGrid } from '@/components/TimeGrid';
import { MonthGrid } from '@/components/MonthGrid';
import { detectConflicts, type Booking } from '@/lib/calendar/conflicts';
import { loadOrgRange } from '@/lib/calendar/load';
import { requireActiveOrg } from '@/lib/org';
import {
  addDays,
  addMonths,
  fmtSlotRange,
  isValidDate,
  kstDateStr,
  kstWeekday,
  monthGridDays,
} from '@/lib/matching/slots';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
type View = 'day' | 'week' | 'month';

const fmt = (b: Booking): string => fmtSlotRange(b.start, b.end - b.start);

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; week?: string }>;
}) {
  const { active, all } = await requireActiveOrg();
  const sp = await searchParams;
  const todayStr = kstDateStr(new Date());

  // 뷰 결정 (구 ?week= 링크 호환: view 없고 week 있으면 주 뷰).
  const view: View =
    sp.view === 'day' || sp.view === 'week' || sp.view === 'month' ? sp.view : 'week';
  // 기준일: ?date= 우선, 없으면 구 ?week=, 둘 다 없으면 오늘. 달력상 무효 날짜는 무시.
  const date =
    sp.date && isValidDate(sp.date)
      ? sp.date
      : sp.week && isValidDate(sp.week)
        ? sp.week
        : todayStr;

  // 뷰별 범위 / 라벨 / 네비 기준일.
  let rangeStart: string;
  let rangeEndExcl: string;
  let label: string;
  let prevDate: string;
  let nextDate: string;
  let todayLabel: string;
  let weekStart = '';
  let monthDays: string[] = [];

  if (view === 'day') {
    rangeStart = date;
    rangeEndExcl = addDays(date, 1);
    label = `${date} (${WD[kstWeekday(date)]})`;
    prevDate = addDays(date, -1);
    nextDate = addDays(date, 1);
    todayLabel = '오늘';
  } else if (view === 'month') {
    monthDays = monthGridDays(date);
    rangeStart = monthDays[0];
    rangeEndExcl = addDays(monthDays[monthDays.length - 1], 1);
    const [y, m] = date.split('-').map(Number);
    label = `${y}년 ${m}월`;
    // 월 네비는 1일 앵커로 — raw 일자(29~31)에서 클램프가 누적돼 드리프트하는 것 방지(되돌림 가능).
    const monthAnchor = `${y}-${String(m).padStart(2, '0')}-01`;
    prevDate = addMonths(monthAnchor, -1);
    nextDate = addMonths(monthAnchor, 1);
    todayLabel = '이번달';
  } else {
    weekStart = addDays(date, -kstWeekday(date)); // 그 주 일요일
    rangeStart = weekStart;
    rangeEndExcl = addDays(weekStart, 7);
    label = `${weekStart} ~ ${addDays(weekStart, 6)}`;
    prevDate = addDays(weekStart, -7);
    nextDate = addDays(weekStart, 7);
    todayLabel = '이번주';
  }

  const { bookings, nameById } = await loadOrgRange(active.orgId, rangeStart, rangeEndExcl);
  const report = detectConflicts(bookings);
  const byId = new Map(bookings.map((b) => [b.id, b]));

  const tabs: { v: View; text: string }[] = [
    { v: 'day', text: '일' },
    { v: 'week', text: '주' },
    { v: 'month', text: '월' },
  ];

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[19px] font-semibold tracking-tight">합주실 캘린더</h1>
          <div className="inline-flex rounded-lg bg-hover p-0.5">
            {tabs.map((t) => (
              <Link
                key={t.v}
                href={`/calendar?view=${t.v}&date=${date}`}
                aria-current={view === t.v ? 'page' : undefined}
                className={`rounded-md px-3.5 py-1 text-[13px] font-medium transition-colors duration-150 ${
                  view === t.v ? 'bg-surface text-ink shadow-sm' : 'text-mut hover:text-ink'
                }`}
              >
                {t.text}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?view=${view}&date=${prevDate}`}
              aria-label="이전"
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-mut transition-colors duration-150 hover:bg-hover hover:text-ink"
            >
              <IconChevronLeft size={17} stroke={1.5} />
            </Link>
            <Link
              href={`/calendar?view=${view}`}
              className="rounded-lg border px-3 py-1.5 text-[13px] font-medium text-mut transition-colors duration-150 hover:bg-hover hover:text-ink"
            >
              {todayLabel}
            </Link>
            <Link
              href={`/calendar?view=${view}&date=${nextDate}`}
              aria-label="다음"
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-mut transition-colors duration-150 hover:bg-hover hover:text-ink"
            >
              <IconChevronRight size={17} stroke={1.5} />
            </Link>
          </div>
          <p className="text-[13px] font-medium tabular-nums text-mut">{label}</p>
        </div>

        {/* 더블부킹 경고 */}
        {report.pairs.length > 0 && (
          <section className="flex flex-col gap-1.5 rounded-xl bg-danger-bg/50 p-3.5 text-sm">
            <div className="flex items-center gap-1.5 font-semibold text-danger-text">
              <IconAlertTriangle size={16} stroke={1.5} />
              일정 충돌 {report.pairs.length}건
            </div>
            <ul className="flex flex-col gap-1">
              {report.pairs.map((p, i) => {
                const a = byId.get(p.a);
                const b = byId.get(p.b);
                if (!a || !b) return null;
                const shared = p.sharedMembers.map((u) => nameById.get(u) ?? u).join(', ');
                return (
                  <li key={i} className="text-ink">
                    <span
                      className={`mr-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        p.kind === 'room'
                          ? 'bg-danger-bg text-danger-text'
                          : 'bg-warn-bg text-warn-text'
                      }`}
                    >
                      {p.kind === 'room' ? '방 중복' : '시간 겹침'}
                    </span>
                    <b className="font-medium">{a.title}</b> ({fmt(a)}) ↔{' '}
                    <b className="font-medium">{b.title}</b> ({fmt(b)})
                    {shared && <span className="text-mut"> · 공통: {shared}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {view === 'day' && (
          <TimeGrid days={[date]} bookings={bookings} report={report} todayStr={todayStr} />
        )}
        {view === 'week' && (
          <WeekGrid weekStart={weekStart} bookings={bookings} report={report} todayStr={todayStr} />
        )}
        {view === 'month' && (
          <MonthGrid
            days={monthDays}
            bookings={bookings}
            report={report}
            todayStr={todayStr}
            year={Number(date.split('-')[0])}
            month={Number(date.split('-')[1])}
          />
        )}

        {bookings.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-mut">이 기간에 확정된 합주·회의가 없어요.</p>
            <Link
              href="/availability"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-primary-soft"
            >
              <IconBrush size={15} stroke={1.5} />
              되는 시간 칠하러 가기
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-mut">
          <Legend cls="bg-primary-soft" label="합주" />
          <Legend cls="bg-meeting-bg" label="회의" />
          <Legend cls="bg-danger-bg" label="방 중복" />
          <Legend cls="bg-warn-bg" label="시간 겹침" />
        </div>
      </main>
    </>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-[4px] border ${cls}`} />
      {label}
    </span>
  );
}
