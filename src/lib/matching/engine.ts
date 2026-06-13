// 합주 단건 매칭 엔진 (Bandmeet 6단계)
//
// 한 곡의 담당자들(song_members)이 동시에 가능한 hour-slot 을 찾아
// 1~2시간 합주 후보 슬롯을 사전식 점수순으로 추천한다.
//
// 시간 모델: 정수 hour-slot. 슬롯 1칸 = 1시간.
// window [s, s+L) 는 시간 s, s+1, ..., s+L-1 을 점유 (end 미포함, half-open).
// 엔진은 DB/타임존 비의존 — 순수 TypeScript, 외부 import 전혀 없음.

export type Tier = 'green' | 'yellow'; // 가능 / 되면가능

export interface MemberAvailability {
  userId: string;
  slots: Map<number, Tier>; // 가용 hour-slot -> tier. 없는 슬롯 = 불가.
  busy: Set<number>; // 이미 점유된 hour-slot (확정 rehearsal + meeting 을 시간단위 전개)
  existing: Array<{ start: number; end: number }>; // 그 멤버의 기존 확정 rehearsal 구간 [start,end) — 이어서 보너스용
}

export interface RecommendInput {
  members: MemberAvailability[]; // 곡의 song_members (k명). 비면 결과 []
  roomBusy: Set<number>; // org 합주실 점유 hour-slot (확정 rehearsal). 방 1개 → 겹치면 불가
  roomIntervals: Array<{ start: number; end: number }>; // 방 점유 구간 [start,end) — 방 인접 보너스용
  candidateSlots: number[]; // 후보 시작 hour-slot 목록 (정렬 안 돼있을 수 있음, 중복 가능)
  durations: number[]; // 허용 window 길이(시간), 예: [1,2]
  topK: number;
}

export interface RankedSlot {
  start: number;
  duration: number; // 시간
  yellowMembers: number; // 이 window 에서 yellow 를 쓰는 멤버 수 (낮을수록 좋음)
  continuity: number; // 이어서 인접 카운트 (높을수록 좋음)
  roomAdjacency: number; // 방 점유 인접 카운트 (높을수록 좋음)
}

/**
 * window [s, s+L) 가 유효한지 판정하고, 유효하면 yellow 사용 멤버 수를 반환.
 * 무효면 null.
 *
 * 유효 조건:
 *  1. 모든 멤버: 모든 시간 h∈[s,s+L) 가 slots 에 존재 AND busy 에 없음.
 *  2. 모든 시간 h 가 roomBusy 에 없음.
 *
 * yellowMembers = window 의 어느 시간이라도 yellow 인 distinct user 수.
 * 한 멤버가 한 시간 green, 다른 시간 yellow 면 그 멤버는 yellow 1로 카운트.
 * 같은 userId 가 members 에 중복 등장해도 distinct user 로 한 번만 카운트(스펙 'distinct user').
 */
function evaluateWindow(
  members: MemberAvailability[],
  roomBusy: Set<number>,
  s: number,
  L: number,
): number | null {
  // 방 점유 확인 (방 1개) — window 의 모든 시간이 비어야 함.
  for (let h = s; h < s + L; h++) {
    if (roomBusy.has(h)) return null;
  }

  const yellowUsers = new Set<string>();
  for (const m of members) {
    let memberUsesYellow = false;
    for (let h = s; h < s + L; h++) {
      if (m.busy.has(h)) return null; // 사람 충돌 (다른 곡 확정 합주/미팅)
      const tier = m.slots.get(h);
      if (tier === undefined) return null; // 가용 슬롯 아님
      if (tier === 'yellow') memberUsesYellow = true;
    }
    if (memberUsesYellow) yellowUsers.add(m.userId);
  }
  return yellowUsers.size;
}

/**
 * 이어서 인접 카운트. 시간 경계로만 인코딩 (리스트 인덱스 금지).
 * 각 멤버 existing 구간 중 end===s 또는 start===(s+L) 인 것의 합.
 */
function countContinuity(
  members: MemberAvailability[],
  s: number,
  L: number,
): number {
  const end = s + L;
  let count = 0;
  for (const m of members) {
    for (const iv of m.existing) {
      if (iv.end === s || iv.start === end) count++;
    }
  }
  return count;
}

/**
 * 방 인접 카운트. roomIntervals 중 end===s 또는 start===(s+L) 인 것의 수.
 */
function countRoomAdjacency(
  roomIntervals: Array<{ start: number; end: number }>,
  s: number,
  L: number,
): number {
  const end = s + L;
  let count = 0;
  for (const iv of roomIntervals) {
    if (iv.end === s || iv.start === end) count++;
  }
  return count;
}

/**
 * 사전식(lexicographic) 비교. 음수면 a 가 우선(앞).
 * 우선순위:
 *  1. yellowMembers 오름차순 (최소화, all-green 우선)
 *  2. continuity 내림차순 (최대화)
 *  3. roomAdjacency 내림차순 (최대화)
 *  4. start 오름차순 (빠른 슬롯 우선)
 *  5. duration 내림차순 (긴 합주 우선)
 * 모든 키가 동률이면 0 — 완전 결정적.
 */
function compareRanked(a: RankedSlot, b: RankedSlot): number {
  if (a.yellowMembers !== b.yellowMembers) return a.yellowMembers - b.yellowMembers;
  if (a.continuity !== b.continuity) return b.continuity - a.continuity;
  if (a.roomAdjacency !== b.roomAdjacency) return b.roomAdjacency - a.roomAdjacency;
  if (a.start !== b.start) return a.start - b.start;
  if (a.duration !== b.duration) return b.duration - a.duration;
  return 0;
}

export function recommendSlots(input: RecommendInput): RankedSlot[] {
  const { members, roomBusy, roomIntervals, candidateSlots, durations, topK } = input;

  // 빈 입력 차단.
  if (members.length === 0) return [];
  if (candidateSlots.length === 0) return [];
  if (durations.length === 0) return [];
  if (topK <= 0) return [];

  // 후보 시작 slot 중복 제거 + 정렬 (결정성).
  // 정수 hour-slot 만 허용 — NaN/Infinity/소수 start 는 출력으로 새지 않도록 차단.
  const uniqueStarts = Array.from(new Set(candidateSlots))
    .filter((s) => Number.isInteger(s))
    .sort((a, b) => a - b);

  // duration 도 중복 제거 + 정렬 (결정성).
  const uniqueDurations = Array.from(new Set(durations)).sort((a, b) => a - b);

  const ranked: RankedSlot[] = [];

  for (const s of uniqueStarts) {
    for (const L of uniqueDurations) {
      // 비정상 duration 방어: 양의 정수만 허용 (NaN<=0 은 false 라 L<=0 만으로는 못 막음;
      // Infinity 는 무한 루프, 소수는 half-open 길이 위반).
      if (!Number.isInteger(L) || L <= 0) continue;
      const yellowMembers = evaluateWindow(members, roomBusy, s, L);
      if (yellowMembers === null) continue; // 하드 필터 위반 → 후보 아님.
      ranked.push({
        start: s,
        duration: L,
        yellowMembers,
        continuity: countContinuity(members, s, L),
        roomAdjacency: countRoomAdjacency(roomIntervals, s, L),
      });
    }
  }

  ranked.sort(compareRanked);

  return ranked.slice(0, topK);
}
