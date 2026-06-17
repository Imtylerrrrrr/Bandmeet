// 월간 격자(읽기 전용). 한 칸 = 하루. 칸을 클릭하면 그 날 '일 뷰'로 이동.
// 각 칸엔 날짜 + 예약 칩(최대 3개, 충돌 색) + 초과분 '+N'. 이웃 달 날짜는 흐리게.

import Link from 'next/link';

import { dateHourToSlot } from '@/lib/matching/slots';
import type { Booking, ConflictReport } from '@/lib/calendar/conflicts';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export function MonthGrid({
  days,
  bookings,
  report,
  todayStr,
  year,
  month,
}: {
  days: string[]; // monthGridDays 결과(일요일 시작, 35/42칸)
  bookings: Booking[];
  report: ConflictReport;
  todayStr?: string;
  year: number;
  month: number; // 1-based (이 달이 아닌 칸은 흐리게)
}) {
  // 예약을 일(epoch day)별로 묶기.
  const byDay = new Map<number, Booking[]>();
  for (const b of bookings) {
    const day = Math.floor(b.start / 24);
    const arr = byDay.get(day) ?? [];
    arr.push(b);
    byDay.set(day, arr);
  }
  for (const arr of byDay.values()) arr.sort((a, b) => a.start - b.start);

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="grid min-w-[480px] grid-cols-7 overflow-hidden rounded-xl border-l border-t text-xs">
        {/* 요일 헤더 */}
        {WD.map((w) => (
          <div
            key={w}
            className="border-b border-r bg-canvas px-1 py-2 text-center text-[11px] font-medium text-mut"
          >
            {w}
          </div>
        ))}

        {/* 날짜 칸 */}
        {days.map((d) => {
          const epoch = dateHourToSlot(d, 0) / 24;
          const [yy, mm, dd] = d.split('-').map(Number);
          const inMonth = yy === year && mm === month;
          const isToday = d === todayStr;
          const dayBookings = byDay.get(epoch) ?? [];

          return (
            <Link
              key={d}
              href={`/calendar?view=day&date=${d}`}
              className={`flex min-h-[76px] flex-col gap-1 border-b border-r p-1.5 transition-colors duration-150 hover:bg-hover ${
                inMonth ? 'bg-surface' : 'bg-canvas'
              }`}
            >
              <div className="flex justify-end">
                {isToday && inMonth ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold tabular-nums text-white">
                    {dd}
                  </span>
                ) : (
                  <span
                    className={`px-0.5 text-[12px] tabular-nums ${
                      inMonth ? 'text-mut' : 'text-faint'
                    }`}
                  >
                    {dd}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {dayBookings.slice(0, 3).map((b) => {
                  const isRoom = report.roomConflictIds.has(b.id);
                  const isConflict = report.conflictIds.has(b.id);
                  const tone = isRoom
                    ? 'bg-danger-bg text-danger-text'
                    : isConflict
                      ? 'bg-warn-bg text-warn-text'
                      : b.type === 'meeting'
                        ? 'bg-meeting-bg text-meeting-text'
                        : 'bg-primary-soft text-primary-ink';
                  const sh = ((b.start % 24) + 24) % 24;
                  return (
                    <div
                      key={b.id}
                      className={`truncate rounded-md px-1 py-0.5 leading-tight ${tone}`}
                      title={`${b.title} ${sh}:00`}
                    >
                      <span className="tabular-nums opacity-80">{String(sh).padStart(2, '0')}</span>{' '}
                      {b.title}
                    </div>
                  );
                })}
                {dayBookings.length > 3 && (
                  <div className="px-1 text-faint">+{dayBookings.length - 3}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
