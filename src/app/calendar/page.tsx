import Link from 'next/link';

import { AppHeader } from '@/components/AppHeader';
import { WeekGrid } from '@/components/WeekGrid';
import { detectConflicts, type Booking } from '@/lib/calendar/conflicts';
import { loadOrgWeek } from '@/lib/calendar/load';
import { requireActiveOrg } from '@/lib/org';
import { addDays, fmtSlotRange, kstDateStr, kstWeekday } from '@/lib/matching/slots';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fmt = (b: Booking): string => fmtSlotRange(b.start, b.end - b.start);

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { active, all } = await requireActiveOrg();
  const sp = await searchParams;

  const todayStr = kstDateStr(new Date());
  const base = sp.week && DATE_RE.test(sp.week) ? sp.week : todayStr;
  const weekStart = addDays(base, -kstWeekday(base)); // 그 주 일요일
  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  const { bookings, nameById } = await loadOrgWeek(active.orgId, weekStart);
  const report = detectConflicts(bookings);
  const byId = new Map(bookings.map((b) => [b.id, b]));

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">합주실 캘린더</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/calendar?week=${prev}`} className="rounded border px-2 py-1 hover:bg-gray-50">
              ← 이전주
            </Link>
            <Link href="/calendar" className="rounded border px-2 py-1 hover:bg-gray-50">
              이번주
            </Link>
            <Link href={`/calendar?week=${next}`} className="rounded border px-2 py-1 hover:bg-gray-50">
              다음주 →
            </Link>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          {weekStart} ~ {weekEnd}
        </p>

        {/* 더블부킹 경고 */}
        {report.pairs.length > 0 && (
          <section className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <div className="font-semibold text-red-700">
              ⚠ 일정 충돌 {report.pairs.length}건
            </div>
            <ul className="flex flex-col gap-1">
              {report.pairs.map((p, i) => {
                const a = byId.get(p.a);
                const b = byId.get(p.b);
                if (!a || !b) return null;
                const shared = p.sharedMembers
                  .map((u) => nameById.get(u) ?? u)
                  .join(', ');
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

        <WeekGrid weekStart={weekStart} bookings={bookings} report={report} todayStr={todayStr} />

        {bookings.length === 0 && (
          <p className="text-sm text-gray-500">이번 주 확정된 합주·회의가 없습니다.</p>
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
