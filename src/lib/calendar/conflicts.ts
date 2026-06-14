// 캘린더 더블부킹 감지 (순수, 의존성 없음).
//
// 합주실 마스터 캘린더에서 시간이 겹치는 예약을 찾아 경고한다(빌드매뉴얼 §6·§7).
//  - room  : 두 '합주'가 시간 겹침 → 방 1개 위반(하드, 빨강). close-votes 가 보통 막지만
//            수동 편집/비정기(is_extra) 합주로 생길 수 있어 캘린더가 최종 안전망.
//  - overlap: 그 외 시간 겹침(합주↔회의 등). 방은 안 겹쳐도 사람이 곤란할 수 있어 정보성(노랑).
//
// 시간 모델은 엔진/집계와 동일한 정수 hour-slot. 구간 [start, end) half-open.

export type BookingType = 'rehearsal' | 'meeting';

export interface Booking {
  id: string;
  type: BookingType;
  start: number; // KST hour-slot
  end: number; // half-open
  title: string;
  members: string[]; // 알려진 참여자 userId (합주=song_members, 회의=명단 없음 → [])
}

export interface ConflictPair {
  a: string; // booking id (정렬상 앞)
  b: string; // booking id
  kind: 'room' | 'overlap';
  sharedMembers: string[]; // 두 예약이 공유하는 참여자(있으면)
}

export interface ConflictReport {
  pairs: ConflictPair[];
  conflictIds: Set<string>; // 어떤 충돌에든 연루된 booking id
  roomConflictIds: Set<string>; // 방 중복(하드)에 연루된 id
}

/** 두 구간 [a.start,a.end) 와 [b.start,b.end) 가 겹치면 true. half-open. */
export function overlaps(a: Booking, b: Booking): boolean {
  return a.start < b.end && b.start < a.end;
}

/** 두 멤버 배열의 교집합(중복 제거, 입력 순서 보존). */
function intersectMembers(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of a) {
    if (setB.has(m) && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/**
 * 모든 예약 쌍을 검사해 시간 겹침을 보고.
 * 쌍 순서는 입력 인덱스 i<j 로 결정적(=a 가 먼저 등장한 예약).
 */
export function detectConflicts(bookings: Booking[]): ConflictReport {
  const pairs: ConflictPair[] = [];
  const conflictIds = new Set<string>();
  const roomConflictIds = new Set<string>();

  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];
      if (!overlaps(a, b)) continue;

      const kind: ConflictPair['kind'] =
        a.type === 'rehearsal' && b.type === 'rehearsal' ? 'room' : 'overlap';
      pairs.push({
        a: a.id,
        b: b.id,
        kind,
        sharedMembers: intersectMembers(a.members, b.members),
      });
      conflictIds.add(a.id);
      conflictIds.add(b.id);
      if (kind === 'room') {
        roomConflictIds.add(a.id);
        roomConflictIds.add(b.id);
      }
    }
  }

  return { pairs, conflictIds, roomConflictIds };
}
