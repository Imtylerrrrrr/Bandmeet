// 시간 ↔ 정수 slot 매핑 (순수, 의존성 없음).
// slot = 1970-01-01T00:00 KST 기준 경과 '시간(hour)'. KST=UTC+9 (DST 없음).
// 같은 날 연속 시는 연속 정수. 합주 band 시간 [10,24) 밖(밤/새벽)은 가용성이 없어 자연 차단된다.

export const KST_OFFSET_MS = 9 * 3600 * 1000;
export const HOUR_MS = 3600 * 1000;
export const BAND_START_HOUR = 10; // 합주 가능 시간대 [10, 24)
export const BAND_END_HOUR = 24;

/** KST 달력 날짜 'YYYY-MM-DD' + 시(0~23) → slot. */
export function dateHourToSlot(dateStr: string, hour: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / HOUR_MS + hour;
}

/** slot → 실제 UTC 인스턴트(Date). 그 slot 의 KST 벽시계 정시. */
export function slotToDate(slot: number): Date {
  return new Date((slot - 9) * HOUR_MS);
}

/** timestamptz 인스턴트 → 그 시각이 속한 KST 정시 slot(내림). */
export function instantToSlot(ts: Date): number {
  return Math.floor((ts.getTime() + KST_OFFSET_MS) / HOUR_MS);
}

/** 분 → 점유 시간 수(올림, 최소 1). */
export function durationToHours(min: number): number {
  return Math.max(1, Math.ceil(min / 60));
}

/** 인스턴트 → KST 달력 날짜 'YYYY-MM-DD'. */
export function kstDateStr(ts: Date): string {
  const k = new Date(ts.getTime() + KST_OFFSET_MS);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(
    k.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → 요일(0=일 ~ 6=토). */
export function kstWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 'YYYY-MM-DD' → epoch 일수. */
export function dateStrToDays(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** 'YYYY-MM-DD' 에 n일 더한 날짜 문자열. */
export function addDays(dateStr: string, n: number): string {
  const t = new Date((dateStrToDays(dateStr) + n) * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * 'YYYY-MM-DD' 가 형식 + 달력상 유효한지(월 1~12, 일 ≤ 그 달 말일).
 * Date.UTC 는 범위 밖 값을 조용히 롤오버하므로(2026-13-45 → 2027-02-15) 입력 검증에 필요.
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 그 달 말일
  return d <= dim;
}

/** 'YYYY-MM-DD' 에 n개월 더한 날짜(일자는 대상 월 말일로 클램프: 1/31 +1달 = 2/28). */
export function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12; // 0-based 월
  const dim = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate(); // 대상 월 일수
  const nd = Math.min(d, dim);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * 'YYYY-MM-DD' 가 속한 달의 월간 격자 날짜들(일요일 시작, 길이=35 또는 42).
 * 앞뒤 칸은 이웃 달 날짜로 채워진다(달력 칸 채우기용).
 */
export function monthGridDays(dateStr: string): string[] {
  const [y, m] = dateStr.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lead = kstWeekday(first); // 0=일 ~ 6=토 (앞 빈칸 수)
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 이 달 일수
  const cells = Math.max(35, Math.ceil((lead + dim) / 7) * 7); // 35 또는 42 (일요일 시작 평년 2월도 최소 5주)
  const gridStart = addDays(first, -lead);
  return Array.from({ length: cells }, (_, i) => addDays(gridStart, i));
}

/** timestamptz + 분 → 정수 hour-slot 구간 [start, end). 점유/예약 인터벌 빌더(단일 출처). */
export function toInterval(
  startAt: Date,
  durationMin: number,
): { start: number; end: number } {
  const start = instantToSlot(startAt);
  return { start, end: start + durationToHours(durationMin) };
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 시작 slot + 지속시간(시간) → 'M/D(요일) HH:00–HH:00' (KST).
 * 끝이 24시를 넘으면 익일 표기('…–01:00(익일)'). 시각 표기 단일 출처.
 */
export function fmtSlotRange(startSlot: number, durationHours: number): string {
  const date = addDays('1970-01-01', Math.floor(startSlot / 24));
  const [, m, d] = date.split('-').map(Number);
  const sh = ((startSlot % 24) + 24) % 24;
  const ehRaw = sh + durationHours;
  const ehLabel =
    ehRaw >= 24
      ? `${String(ehRaw % 24).padStart(2, '0')}:00(익일)`
      : `${String(ehRaw).padStart(2, '0')}:00`;
  return `${m}/${d}(${WD[kstWeekday(date)]}) ${String(sh).padStart(2, '0')}:00–${ehLabel}`;
}
