import Link from 'next/link';

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
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold">합주실 캘린더</h1>
          <div className="flex items-center gap-1 text-sm">
            {tabs.map((t) => (
              <Link
                key={t.v}
                href={`/calendar?view=${t.v}&date=${date}`}
                className={`rounded px-3 py-1 ${
                  view === t.v ? 'bg-black text-white' : 'border hover:bg-gray-50'
                }`}
              >
                {t.text}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?view=${view}&date=${prevDate}`}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              ←
            </Link>
            <Link href={`/calendar?view=${view}`} className="rounded border px-2 py-1 hover:bg-gray-50">
              {todayLabel}
            </Link>
            <Link
              href={`/calendar?view=${view}&date=${nextDate}`}
              className="rounded border px-2 py-1 hover:bg-gray-50"
            >
              →
            </Link>
          </div>
          <p className="text-gray-500">{label}</p>
        </div>

        {/* 더블부킹 경고 */}
        {report.pairs.length > 0 && (
          <section className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <div className="font-semibold text-red-700">일정 충돌 {report.pairs.length}건</div>
            <ul className="flex flex-col gap-1">
              {report.pairs.map((p, i) => {
                const a = byId.get(p.a);
                const b = byId.get(p.b);
                if (!a || !b) return null;
                const shared = p.sharedMembers.map((u) => nameById.get(u) ?? u).join(', ');
                return (
                  <li key={i} className="text-gray-700">
                    <span
                      className={`mr-1 rounded px-1 py-0.5 text-xs ${
                        p.kind === 'room'
                          ? 'bg-red-200 text-red-800'
                          : 'bg-amber-200 text-amber-800'
                      }`}
                    >
                      {p.kind === 'room' ? '방 중복' : '시간 겹침'}
                    </span>
                    <b>{a.title}</b> ({fmt(a)}) ↔ <b>{b.title}</b> ({fmt(b)})
                    {shared && <span className="text-gray-500"> · 공통: {shared}</span>}
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
          <p className="text-sm text-gray-500">이 기간에 확정된 합주·회의가 없습니다.</p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <Legend cls="bg-indigo-100 border-indigo-300" label="합주" />
          <Legend cls="bg-slate-100 border-slate-300" label="회의" />
          <Legend cls="bg-red-100 border-red-400" label="방 중복" />
          <Legend cls="bg-amber-100 border-amber-400" label="시간 겹침" />
        </div>
      </main>
    </>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded border ${cls}`} />
      {label}
    </span>
  );
}
