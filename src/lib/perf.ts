// 공연 날짜 표시 라벨. 시작/종료(선택) 범위를 일관되게 포맷.
export function perfDateLabel(
  start: string | null,
  end: string | null,
): string {
  if (!start) return '공연일 미정';
  if (end && end !== start) return `공연 ${start} ~ ${end}`;
  return `공연일 ${start}`;
}
