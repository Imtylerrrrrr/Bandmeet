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
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 border-l border-t text-xs">
        {/* 요일 헤더 */}
        {WD.map((w, i) => (
          <div
            key={w}
            className={`border-b border-r px-1 py-1 text-center font-medium ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}
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
              className={`flex min-h-[88px] flex-col border-b border-r p-1 hover:bg-gray-50 ${
                inMonth ? '' : 'bg-gray-50/60'
              }`}
            >
              <div
                className={`text-right ${
                  isToday && inMonth
                    ? 'font-bold text-blue-600'
                    : inMonth
                      ? 'text-gray-600'
                      : 'text-gray-300'
                }`}
              >
                {dd}
              </div>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {dayBookings.slice(0, 3).map((b) => {
                  const isRoom = report.roomConflictIds.has(b.id);
                  const isConflict = report.conflictIds.has(b.id);
                  const tone = isRoom
                    ? 'bg-red-100 text-red-800'
                    : isConflict
                      ? 'bg-amber-100 text-amber-800'
                      : b.type === 'meeting'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-indigo-100 text-indigo-800';
                  const sh = ((b.start % 24) + 24) % 24;
                  return (
                    <div
                      key={b.id}
                      className={`truncate rounded px-1 leading-tight ${tone}`}
                      title={`${b.title} ${sh}:00`}
                    >
                      {String(sh).padStart(2, '0')} {b.title}
                    </div>
                  );
                })}
                {dayBookings.length > 3 && (
                  <div className="text-gray-400">+{dayBookings.length - 3}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
