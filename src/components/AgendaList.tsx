// 모바일용 일정 리스트(아젠다). 주간 격자가 폰에서 가로로 잘리는 대신, 일정 있는 날만
// 날짜별로 묶어 세로 리스트로 보여준다. 데스크탑은 WeekGrid 유지(page에서 분기).

import { addDays, dateHourToSlot, kstWeekday } from '@/lib/matching/slots';
import type { Booking, ConflictReport } from '@/lib/calendar/conflicts';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

function dayMonth(d: string): string {
  const [, m, day] = d.split('-').map(Number);
  return `${m}/${day}`;
}

export function AgendaList({
  weekStart,
  bookings,
  report,
  todayStr,
}: {
  weekStart: string;
  bookings: Booking[];
  report: ConflictReport;
  todayStr?: string;
}) {
  const firstEpoch = dateHourToSlot(weekStart, 0) / 24;
  const byDay = new Map<number, Booking[]>();
  for (const b of bookings) {
    const di = Math.floor(b.start / 24) - firstEpoch;
    if (di < 0 || di > 6) continue;
    (byDay.get(di) ?? byDay.set(di, []).get(di)!).push(b);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <ul className="flex flex-col gap-4">
      {days.map((di) => {
        const date = addDays(weekStart, di);
        const items = byDay.get(di)!.sort((a, b) => a.start - b.start);
        const isToday = date === todayStr;
        return (
          <li key={di} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <span>
                {WD[kstWeekday(date)]} {dayMonth(date)}
              </span>
              {isToday && (
                <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary-ink">
                  오늘
                </span>
              )}
            </div>
            {items.map((b) => {
              const sh = ((b.start % 24) + 24) % 24;
              const eh = sh + (b.end - b.start);
              const isRoom = report.roomConflictIds.has(b.id);
              const isConflict = report.conflictIds.has(b.id);
              const dot = isRoom
                ? 'bg-danger-text'
                : isConflict
                  ? 'bg-warn-text'
                  : b.type === 'meeting'
                    ? 'bg-meeting-text'
                    : 'bg-primary';
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-lg border bg-surface px-3 py-2 text-sm"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                  <span className="shrink-0 tabular-nums text-mut">
                    {sh}:00–{eh}:00
                  </span>
                  <span className="truncate font-medium text-ink">{b.title}</span>
                </div>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
