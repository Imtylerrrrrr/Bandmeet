// 주간 시간 격자(읽기 전용). 합주실 캘린더·개인 통합 뷰 공용.
// band 시간 [10,24) × 7일. 모든 셀을 명시 grid 좌표로 배치(자동흐름 X) → 예약 블록이
// 배경 셀 위에 깔끔히 겹친다. 충돌은 색으로 표시.

import { addDays, dateHourToSlot } from '@/lib/matching/slots';
import type { Booking, ConflictReport } from '@/lib/calendar/conflicts';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const START_HOUR = 10;
const END_HOUR = 24;
const HOURS = END_HOUR - START_HOUR; // 14

function dayMonth(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

export function WeekGrid({
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
  const weekStartDay = dateHourToSlot(weekStart, 0) / 24; // 정수 일수
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px] text-xs"
        style={{
          gridTemplateColumns: '40px repeat(7, 1fr)',
          gridTemplateRows: `auto repeat(${HOURS}, 36px)`,
        }}
      >
        {/* 좌상단 빈칸 */}
        <div className="border-b border-r" style={{ gridColumn: 1, gridRow: 1 }} />
        {/* 요일 헤더 */}
        {days.map((d, i) => (
          <div
            key={d}
            className={`border-b border-r px-1 py-1 text-center font-medium ${
              d === todayStr ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
            }`}
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {WD[i]} {dayMonth(d)}
          </div>
        ))}

        {/* 시간 라벨 (1열) */}
        {Array.from({ length: HOURS }, (_, r) => (
          <div
            key={`h${r}`}
            className="border-r border-b pr-1 text-right text-[10px] text-gray-400"
            style={{ gridColumn: 1, gridRow: r + 2 }}
          >
            {START_HOUR + r}
          </div>
        ))}

        {/* 배경 셀 (7일 × 시간) — 모두 명시 좌표 */}
        {Array.from({ length: HOURS }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => (
            <div
              key={`bg${r}-${c}`}
              className="border-r border-b"
              style={{ gridColumn: c + 2, gridRow: r + 2 }}
            />
          )),
        )}

        {/* 예약 블록 — 배경 셀과 같은 좌표에 겹쳐 배치 */}
        {bookings.map((b) => {
          const startHour = ((b.start % 24) + 24) % 24;
          const dayIndex = Math.floor(b.start / 24) - weekStartDay;
          const top = Math.max(START_HOUR, startHour);
          const bottom = Math.min(END_HOUR, startHour + (b.end - b.start));
          if (dayIndex < 0 || dayIndex > 6 || bottom <= top) return null;

          const isRoom = report.roomConflictIds.has(b.id);
          const isConflict = report.conflictIds.has(b.id);
          const tone = isRoom
            ? 'bg-red-100 border-red-400 text-red-800'
            : isConflict
              ? 'bg-amber-100 border-amber-400 text-amber-800'
              : b.type === 'meeting'
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-indigo-100 border-indigo-300 text-indigo-800';

          return (
            <div
              key={b.id}
              className={`z-10 m-px overflow-hidden rounded border px-1 py-0.5 leading-tight ${tone}`}
              style={{
                gridColumn: dayIndex + 2,
                gridRowStart: top - START_HOUR + 2,
                gridRowEnd: bottom - START_HOUR + 2,
              }}
              title={`${b.title} ${top}:00–${bottom}:00`}
            >
              <div className="font-medium">{b.title}</div>
              <div className="opacity-70">
                {top}:00–{bottom}:00
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
