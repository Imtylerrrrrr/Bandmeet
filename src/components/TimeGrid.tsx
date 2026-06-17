// 시간 격자(읽기 전용). 일/주 뷰 공용 — days 길이만큼 열을 만든다(일=1열, 주=7열).
// band 시간 [10,24). 모든 셀을 명시 grid 좌표로 배치(자동흐름 X) → 예약 블록이
// 배경 셀 위에 깔끔히 겹친다. 충돌은 색으로 표시.

import { dateHourToSlot, kstWeekday } from '@/lib/matching/slots';
import type { Booking, ConflictReport } from '@/lib/calendar/conflicts';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const START_HOUR = 10;
const END_HOUR = 24;
const HOURS = END_HOUR - START_HOUR; // 14

function dayMonth(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

export function TimeGrid({
  days,
  bookings,
  report,
  todayStr,
}: {
  days: string[]; // 표시할 날짜들(열). 일 뷰=1개, 주 뷰=7개.
  bookings: Booking[];
  report: ConflictReport;
  todayStr?: string;
}) {
  const n = days.length;
  const firstDayEpoch = dateHourToSlot(days[0], 0) / 24; // 첫 열의 정수 일수
  const minW = n === 1 ? 280 : 640;

  return (
    <div className="min-w-0 overflow-x-auto">
      <div
        className="grid text-xs"
        style={{
          minWidth: minW,
          gridTemplateColumns: `40px repeat(${n}, 1fr)`,
          gridTemplateRows: `auto repeat(${HOURS}, 36px)`,
        }}
      >
        {/* 좌상단 빈칸 */}
        <div className="border-b border-r" style={{ gridColumn: 1, gridRow: 1 }} />
        {/* 요일 헤더 */}
        {days.map((d, i) => (
          <div
            key={d}
            className={`border-b border-r px-1 py-1.5 text-center font-medium ${
              d === todayStr ? 'bg-primary-soft text-primary-ink' : 'text-mut'
            }`}
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {WD[kstWeekday(d)]} {dayMonth(d)}
          </div>
        ))}

        {/* 시간 라벨 (1열) */}
        {Array.from({ length: HOURS }, (_, r) => (
          <div
            key={`h${r}`}
            className="border-r border-b pr-1.5 text-right text-[11px] tabular-nums text-mut"
            style={{ gridColumn: 1, gridRow: r + 2 }}
          >
            {START_HOUR + r}
          </div>
        ))}

        {/* 배경 셀 (n일 × 시간) — 모두 명시 좌표 */}
        {Array.from({ length: HOURS }, (_, r) =>
          Array.from({ length: n }, (_, c) => (
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
          const dayIndex = Math.floor(b.start / 24) - firstDayEpoch;
          const top = Math.max(START_HOUR, startHour);
          const bottom = Math.min(END_HOUR, startHour + (b.end - b.start));
          if (dayIndex < 0 || dayIndex > n - 1 || bottom <= top) return null;

          const isRoom = report.roomConflictIds.has(b.id);
          const isConflict = report.conflictIds.has(b.id);
          const tone = isRoom
            ? 'bg-danger-bg text-danger-text'
            : isConflict
              ? 'bg-warn-bg text-warn-text'
              : b.type === 'meeting'
                ? 'bg-meeting-bg text-meeting-text'
                : 'bg-primary-soft text-primary-ink';

          return (
            <div
              key={b.id}
              className={`z-10 m-px overflow-hidden rounded-md px-1.5 py-0.5 leading-tight ${tone}`}
              style={{
                gridColumn: dayIndex + 2,
                gridRowStart: top - START_HOUR + 2,
                gridRowEnd: bottom - START_HOUR + 2,
              }}
              title={`${b.title} ${top}:00–${bottom}:00`}
            >
              <div className="truncate font-medium">{b.title}</div>
              <div className="tabular-nums opacity-80">
                {top}:00–{bottom}:00
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
