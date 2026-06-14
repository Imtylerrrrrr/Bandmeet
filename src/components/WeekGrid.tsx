// 주간 시간 격자(읽기 전용). 합주실 캘린더·개인 통합 뷰 공용.
// 7일치 날짜를 만들어 TimeGrid(일/주 공용)에 위임한다.

import { addDays } from '@/lib/matching/slots';
import type { Booking, ConflictReport } from '@/lib/calendar/conflicts';
import { TimeGrid } from './TimeGrid';

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
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return <TimeGrid days={days} bookings={bookings} report={report} todayStr={todayStr} />;
}
