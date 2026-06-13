// 합주 단건 매칭 엔진 테스트 (순수 JavaScript ESM — .mjs)
// 실행: node --test src/lib/matching/engine.test.mjs   (Node v22 가 .ts 타입 스트립)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendSlots } from './engine.ts';

// ---- 테스트 헬퍼 ----

// tier 맵 빌더: green slot 배열 + yellow slot 배열 -> Map<number, Tier>
function slots(green = [], yellow = []) {
  const m = new Map();
  for (const h of green) m.set(h, 'green');
  for (const h of yellow) m.set(h, 'yellow'); // yellow 가 green 을 덮어쓰지 않도록 호출측에서 분리
  return m;
}

// 멤버 빌더
function member(userId, opts = {}) {
  return {
    userId,
    slots: opts.slots ?? new Map(),
    busy: new Set(opts.busy ?? []),
    existing: opts.existing ?? [],
  };
}

// 기본 입력 골격
function input(overrides = {}) {
  return {
    members: overrides.members ?? [],
    roomBusy: new Set(overrides.roomBusy ?? []),
    roomIntervals: overrides.roomIntervals ?? [],
    candidateSlots: overrides.candidateSlots ?? [],
    durations: overrides.durations ?? [1, 2],
    topK: overrides.topK ?? 10,
  };
}

// ==========================================================================
// 1. 기본 유효 window / 하드 필터
// ==========================================================================

test('단일 멤버 all-green 1시간 window 가 유효 후보가 된다', () => {
  const m = member('u1', { slots: slots([10, 11, 12]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], {
    start: 10,
    duration: 1,
    yellowMembers: 0,
    continuity: 0,
    roomAdjacency: 0,
  });
});

test('window 의 한 시간이라도 slots 에 없으면 무효', () => {
  // 멤버는 10,11 만 가용. 2시간 window [11,13) 은 12 가 불가 -> 무효.
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [11], durations: [2] }),
  );
  assert.equal(res.length, 0);
});

test('모든 멤버가 동시에 가용해야 한다 (교집합)', () => {
  const a = member('a', { slots: slots([10, 11, 12]) });
  const b = member('b', { slots: slots([11, 12, 13]) });
  // 공통 가용: 11,12. 1시간 후보 10,11,12,13 -> 11,12 만 유효.
  const res = recommendSlots(
    input({
      members: [a, b],
      candidateSlots: [10, 11, 12, 13],
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [11, 12],
  );
});

// ==========================================================================
// 2. half-open 경계 + 방/사람 충돌
// ==========================================================================

test('half-open: 19-21 window 는 19,20 만 점유 (21 은 미포함)', () => {
  // 멤버는 19,20 만 가용 (21 없음). 2시간 [19,21) 은 유효해야 함.
  const m = member('u1', { slots: slots([19, 20]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [19], durations: [2] }),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].start, 19);
  assert.equal(res[0].duration, 2);
});

test('방 점유(roomBusy)와 겹치면 무효', () => {
  const m = member('u1', { slots: slots([10, 11, 12]) });
  // 방이 11 점유 -> [10,12) 무효, [11,12) 무효, [12,..) 는 가용 슬롯에 따라.
  const res = recommendSlots(
    input({
      members: [m],
      roomBusy: [11],
      candidateSlots: [10, 11, 12],
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [10, 12],
  );
});

test('방 점유 21시는 19-21 window(19,20 점유) 와 겹치지 않는다 (half-open)', () => {
  const m = member('u1', { slots: slots([19, 20]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomBusy: [21], // 21 은 [19,21) 에 포함 안 됨
      candidateSlots: [19],
      durations: [2],
    }),
  );
  assert.equal(res.length, 1, '21시 방 점유는 19-21 합주를 막지 않아야 한다');
});

test('사람 충돌: 멤버 busy 에 잡힌 시간은 window 를 무효화한다', () => {
  // 멤버는 10,11,12 가용이지만 11 은 다른 곡 확정 합주로 busy.
  const m = member('u1', { slots: slots([10, 11, 12]), busy: [11] });
  const res = recommendSlots(
    input({
      members: [m],
      candidateSlots: [10, 11, 12],
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [10, 12],
  );
});

test('사람 충돌은 2시간 window 도 무효화한다', () => {
  const m = member('u1', { slots: slots([10, 11, 12, 13]), busy: [12] });
  // [11,13) 은 12 busy -> 무효. [10,12) 는 유효.
  const res = recommendSlots(
    input({
      members: [m],
      candidateSlots: [10, 11],
      durations: [2],
    }),
  );
  assert.deepEqual(
    res.map((r) => `${r.start}+${r.duration}`),
    ['10+2'],
  );
});

// ==========================================================================
// 3. yellow 카운트
// ==========================================================================

test('window 의 어느 시간이라도 yellow 인 멤버는 yellow 1로 카운트', () => {
  // 멤버: 10 green, 11 yellow. 2시간 [10,12) -> 이 멤버 yellow 사용 1.
  const m = member('u1', { slots: slots([10], [11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [2] }),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].yellowMembers, 1);
});

test('한 시간만 보는 window 에서 green 시간만 쓰면 yellow 0', () => {
  const m = member('u1', { slots: slots([10], [11]) });
  // [10,11) 은 green 만 -> yellow 0.
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].yellowMembers, 0);
});

test('yellowMembers 는 distinct user 수 (멤버별 1회 카운트)', () => {
  // 두 멤버 모두 10 green, 11 yellow. [10,12) -> yellow 멤버 2.
  const a = member('a', { slots: slots([10], [11]) });
  const b = member('b', { slots: slots([10], [11]) });
  const res = recommendSlots(
    input({ members: [a, b], candidateSlots: [10], durations: [2] }),
  );
  assert.equal(res[0].yellowMembers, 2);
});

test('all-green window 가 yellow 포함 window 보다 우선 정렬된다', () => {
  // 10: 둘 다 green. 11: a green / b yellow.
  const a = member('a', { slots: slots([10, 11]) });
  const b = member('b', { slots: slots([10], [11]) });
  // 후보 시작 10,11 (1시간). [10,11) yellow0, [11,12) yellow1.
  const res = recommendSlots(
    input({ members: [a, b], candidateSlots: [10, 11], durations: [1] }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.yellowMembers]),
    [
      [10, 0],
      [11, 1],
    ],
  );
});

// ==========================================================================
// 4. continuity (이어서) — 시간 경계 인코딩
// ==========================================================================

test('continuity: existing.end === s 면 이어서 +1 (앞에 붙음)', () => {
  // 멤버 기존 합주 [8,10). 후보 [10,11) -> end(10)===s(10) 이어서 +1.
  const m = member('u1', {
    slots: slots([10, 11]),
    existing: [{ start: 8, end: 10 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].continuity, 1);
});

test('continuity: existing.start === s+L 면 이어서 +1 (뒤에 붙음)', () => {
  // 멤버 기존 합주 [12,14). 후보 [10,12) -> start(12)===s+L(12) 이어서 +1.
  const m = member('u1', {
    slots: slots([10, 11]),
    existing: [{ start: 12, end: 14 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [2] }),
  );
  assert.equal(res[0].continuity, 1);
});

test('continuity 는 양쪽 인접을 모두 합산하고 멤버 전체를 합한다', () => {
  // a: 기존 [8,10) (앞) + [11,13) (뒤). b: 기존 [11,12) (뒤).
  // 후보 [10,11): a 앞붙음(+1), a 뒤붙음 start11===11(+1), b 뒤붙음 start11===11(+1) -> 3.
  const a = member('a', {
    slots: slots([10]),
    existing: [
      { start: 8, end: 10 },
      { start: 11, end: 13 },
    ],
  });
  const b = member('b', {
    slots: slots([10]),
    existing: [{ start: 11, end: 12 }],
  });
  const res = recommendSlots(
    input({ members: [a, b], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].continuity, 3);
});

test('continuity 는 리스트 인덱스가 아니라 시간 경계로만 (겹치는/먼 구간은 0)', () => {
  // 기존 [8,9): end 9 !== s 10, start 8 !== 11. 인접 아님 -> 0.
  const m = member('u1', {
    slots: slots([10]),
    existing: [{ start: 8, end: 9 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].continuity, 0);
});

test('continuity 가 높은 window 가 (yellow 동률일 때) 우선 정렬된다', () => {
  // 둘 다 all-green. [10,11) 은 기존 [8,10) 에 이어서(+1). [12,13) 은 인접 없음(0).
  const m = member('u1', {
    slots: slots([10, 12]),
    existing: [{ start: 8, end: 10 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, 12], durations: [1] }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.continuity]),
    [
      [10, 1],
      [12, 0],
    ],
  );
});

// ==========================================================================
// 5. roomAdjacency (방 인접)
// ==========================================================================

test('roomAdjacency: roomIntervals.end === s 또는 start === s+L 카운트', () => {
  // 방 점유 [21,22). 후보 [19,21) -> start(21)===s+L(21) 인접 +1.
  const m = member('u1', { slots: slots([19, 20]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [{ start: 21, end: 22 }],
      candidateSlots: [19],
      durations: [2],
    }),
  );
  assert.equal(res[0].roomAdjacency, 1);
});

test('roomAdjacency 가 yellow/continuity 동률일 때 정렬 우선', () => {
  const m = member('u1', {
    slots: slots([10, 14]),
  });
  // 방 [9,10) 인접 -> [10,11) roomAdj 1. [14,15) 인접 없음 -> 0.
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [{ start: 9, end: 10 }],
      candidateSlots: [10, 14],
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.roomAdjacency]),
    [
      [10, 1],
      [14, 0],
    ],
  );
});

// ==========================================================================
// 6. 정렬 (사전식 전체 + tie-break)
// ==========================================================================

test('정렬 우선순위: yellow > continuity > roomAdj > start > duration', () => {
  // 동일 start 에서 yellow 동률, continuity 동률, roomAdj 동률이면
  // start 오름 -> duration 내림.
  const m = member('u1', { slots: slots([10, 11, 12]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1, 2] }),
  );
  // start 10 에서 duration 2 가 1보다 먼저 (긴 합주 우선).
  assert.deepEqual(
    res.map((r) => r.duration),
    [2, 1],
  );
});

test('start 오름차순이 duration 보다 우선 (다른 start 비교)', () => {
  const m = member('u1', { slots: slots([10, 11, 12, 13]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, 12], durations: [1, 2] }),
  );
  // 모든 키 동률(yellow0,cont0,room0) -> start 오름, 같은 start 내 duration 내림.
  assert.deepEqual(
    res.map((r) => `${r.start}+${r.duration}`),
    ['10+2', '10+1', '12+2', '12+1'],
  );
});

test('완전 결정적: 모든 점수 키가 동률이어도 안정적인 순서', () => {
  const m = member('u1', { slots: slots([10, 11, 12, 13, 14, 15]) });
  const inp = input({
    members: [m],
    candidateSlots: [14, 10, 12, 10], // 비정렬 + 중복
    durations: [2, 1, 2], // 중복
  });
  const r1 = recommendSlots(inp).map((r) => `${r.start}+${r.duration}`);
  const r2 = recommendSlots(inp).map((r) => `${r.start}+${r.duration}`);
  assert.deepEqual(r1, r2, '같은 입력은 같은 출력');
  assert.deepEqual(r1, ['10+2', '10+1', '12+2', '12+1', '14+2', '14+1']);
});

// ==========================================================================
// 7. 빈 입력 / topK / 비정렬·중복 candidate / duration 초과
// ==========================================================================

test('members 가 비면 []', () => {
  const res = recommendSlots(
    input({ members: [], candidateSlots: [10], durations: [1] }),
  );
  assert.deepEqual(res, []);
});

test('candidateSlots 가 비면 []', () => {
  const m = member('u1', { slots: slots([10]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [], durations: [1] }),
  );
  assert.deepEqual(res, []);
});

test('유효 window 가 하나도 없으면 []', () => {
  // 멤버 가용 슬롯과 후보가 전혀 안 겹침.
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [20, 21], durations: [1] }),
  );
  assert.deepEqual(res, []);
});

test('topK 가 결과 수보다 크면 전부 반환', () => {
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({
      members: [m],
      candidateSlots: [10, 11],
      durations: [1],
      topK: 100,
    }),
  );
  assert.equal(res.length, 2);
});

test('topK 가 결과 수보다 작으면 상위 topK 만', () => {
  const m = member('u1', { slots: slots([10, 11, 12, 13]) });
  const res = recommendSlots(
    input({
      members: [m],
      candidateSlots: [10, 11, 12, 13],
      durations: [1],
      topK: 2,
    }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [10, 11],
  );
});

test('topK 0 이하이면 []', () => {
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1], topK: 0 }),
  );
  assert.deepEqual(res, []);
});

test('비정렬·중복 candidateSlots 는 정규화되어 한 번씩만 (정렬된 순서로)', () => {
  const m = member('u1', { slots: slots([10, 11, 12]) });
  const res = recommendSlots(
    input({
      members: [m],
      candidateSlots: [12, 10, 11, 10, 12], // 중복 + 비정렬
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [10, 11, 12],
  );
});

test('duration 이 가용 범위를 초과하면 그 길이는 자연 차단', () => {
  // 멤버 가용 10,11 (2칸). duration 3 은 12 가 불가 -> 무효. duration 1,2 만 유효.
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1, 2, 3] }),
  );
  assert.deepEqual(
    res.map((r) => r.duration),
    [2, 1],
  );
});

// ==========================================================================
// 8. 하루 경계 (로더가 day*24+hour 로 매핑 -> 가용 슬롯 부재로 차단)
// ==========================================================================

test('2시간 window 가 하루 경계를 넘으면 가용 슬롯 부재로 차단', () => {
  // 합주시간 10~23. 23시 시작 2시간 [23,25) 은 24(다음날 0시) 가 가용 슬롯에 없음.
  // (로더가 day0 의 23시 = 23, day1 의 0시 = 24 로 매핑하고 0시는 합주시간 밖 -> slots 없음)
  const m = member('u1', { slots: slots([22, 23]) }); // 24 는 의도적으로 없음
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [23], durations: [2] }),
  );
  assert.equal(res.length, 0, '새벽으로 새는 window 는 차단되어야 한다');
});

test('하루 경계 직전 23시 1시간 합주는 유효', () => {
  const m = member('u1', { slots: slots([23]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [23], durations: [1] }),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].start, 23);
});

// ==========================================================================
// 9. 통합 시나리오 (모든 점수 키가 함께 작동)
// ==========================================================================

test('통합: yellow 최소 -> continuity 최대 -> roomAdj 최대 -> start 빠름 순으로 종합 정렬', () => {
  // 두 멤버 (a,b 동일 가용/기존).
  //  가용 green: 10, 11, 14.  yellow: 15.  (12,13 은 의도적으로 불가)
  //  a,b 기존 합주 [8,10) -> start 10 window 앞붙음(이어서).
  //  방 점유 [13,14): 13 사용금지(roomBusy). [14,15) 는 방 end===14===s -> 우측 인접.
  // 후보 1시간: 10,11,14,15.
  //   10: yellow0, cont2 (a,b 의 [8,10) end===10), roomAdj0
  //   11: yellow0, cont0, roomAdj0
  //   14: yellow0, cont0, roomAdj1 (방 [13,14) end===14===s)
  //   15: yellow2 (a,b 둘 다 yellow)
  // 정렬: 10(cont2) > 14(roomAdj1) > 11(plain, start11) > 15(yellow2)
  const a = member('a', {
    slots: slots([10, 11, 14], [15]),
    existing: [{ start: 8, end: 10 }],
  });
  const b = member('b', {
    slots: slots([10, 11, 14], [15]),
    existing: [{ start: 8, end: 10 }],
  });
  const res = recommendSlots(
    input({
      members: [a, b],
      roomBusy: [13],
      roomIntervals: [{ start: 13, end: 14 }],
      candidateSlots: [10, 11, 14, 15],
      durations: [1],
      topK: 10,
    }),
  );

  assert.deepEqual(
    res.map((r) => r.start),
    [10, 14, 11, 15],
  );
  const byStart = Object.fromEntries(res.map((r) => [r.start, r]));
  assert.equal(byStart[10].continuity, 2);
  assert.equal(byStart[14].roomAdjacency, 1);
  assert.equal(byStart[15].yellowMembers, 2);
});

test('통합: 다른 곡 확정 합주(busy)로 인한 사람 충돌이 후보를 제거', () => {
  // a,b 모두 10,11,12 가용. b 가 11 에 다른 곡 확정 합주 -> busy.
  const a = member('a', { slots: slots([10, 11, 12]) });
  const b = member('b', { slots: slots([10, 11, 12]), busy: [11] });
  const res = recommendSlots(
    input({
      members: [a, b],
      candidateSlots: [10, 11, 12],
      durations: [1, 2],
    }),
  );
  // 11 포함 window 는 b busy 로 무효: [10,12) 무효, [11,12) 무효, [11,13) 무효.
  // 유효: [10,11), [12,13).  ([12,14) 는 13 가용 없음 무효)
  assert.deepEqual(
    res.map((r) => `${r.start}+${r.duration}`),
    ['10+1', '12+1'],
  );
});

// ==========================================================================
// 10. 비정상 duration 방어 (NaN / Infinity / 소수) — 적대적 검증 회귀
//     'L <= 0' 가드는 NaN(NaN<=0===false)/Infinity(무한루프)/소수를 못 막음.
//     이제 Number.isInteger(L) && L>0 만 통과한다.
// ==========================================================================

test('NaN duration 은 통과하지 못하고 [] (팬텀 슬롯 방지)', () => {
  // 방이 완전히 점유(roomBusy 10,11)되어 있어도 NaN window 가 새던 버그.
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomBusy: [10, 11],
      candidateSlots: [10],
      durations: [NaN],
    }),
  );
  assert.deepEqual(res, [], 'NaN duration 은 유효 window 가 아니다');
});

test('NaN duration 이 정상 duration 과 섞여도 NaN 만 걸러진다', () => {
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1, NaN, 2] }),
  );
  // 정상 1,2 는 그대로, NaN 은 제거. duration 내림차순.
  assert.deepEqual(
    res.map((r) => r.duration),
    [2, 1],
  );
  assert.ok(
    res.every((r) => Number.isInteger(r.duration)),
    '출력 duration 은 항상 정수',
  );
});

test('Infinity duration 은 무한 루프 없이 즉시 [] (DoS 방지)', () => {
  const m = member('u1', { slots: slots([10]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [Infinity] }),
  );
  assert.deepEqual(res, [], 'Infinity duration 은 거부되어야 한다 (행 방지)');
});

test('소수 duration(1.5) 은 거부된다 (half-open 정수 길이 위반)', () => {
  // 멤버 10,11 가용. 1.5 는 [10,11.5) 로 길이 불일치 -> 거부.
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1.5] }),
  );
  assert.deepEqual(res, [], '소수 duration 은 정수 시간이 아니므로 거부');
});

test('모든 duration 이 비정상(NaN/Infinity/소수)이면 []', () => {
  const m = member('u1', { slots: slots([10, 11, 12]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [NaN, Infinity, 0.5, -1] }),
  );
  assert.deepEqual(res, []);
});

// ==========================================================================
// 11. 비정상 candidate start 방어 (NaN / 소수)
//     start 는 출력으로 바로 흐르므로 {start:NaN} 같은 팬텀 슬롯이 새면 안 됨.
// ==========================================================================

test('NaN candidate start 는 걸러지고 정수 start 만 남는다', () => {
  const m = member('u1', { slots: slots([10]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, NaN], durations: [1] }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [10],
  );
  assert.ok(
    res.every((r) => Number.isInteger(r.start)),
    '출력 start 는 항상 정수',
  );
});

test('소수 candidate start 는 걸러진다', () => {
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, 10.5], durations: [1] }),
  );
  assert.deepEqual(
    res.map((r) => r.start),
    [10],
  );
});

// ==========================================================================
// 12. distinct user 카운트 — yellowMembers 는 array element 가 아니라 userId 기준
//     (스펙: 'distinct user 수'). 같은 userId 가 members 에 중복 등장해도 1.
//     단 continuity 는 스펙상 '멤버 existing 구간의 합' 이므로 중복 행은 그대로 합산.
// ==========================================================================

test('yellowMembers 는 동일 userId 중복 행을 1로 collapse (distinct)', () => {
  // 같은 user 가 members 에 두 번. yellow 사용 -> distinct user 수 1.
  const u = member('same', { slots: slots([], [10]) }); // 10 yellow
  const res = recommendSlots(
    input({ members: [u, u], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(
    res[0].yellowMembers,
    1,
    '같은 userId 두 번은 distinct yellow user 1',
  );
});

test('distinct yellow: 같은 user 가 한 행 green·한 행 yellow 여도 1', () => {
  const uGreen = member('same', { slots: slots([10]) });
  const uYellow = member('same', { slots: slots([], [10]) });
  const res = recommendSlots(
    input({ members: [uGreen, uYellow], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].yellowMembers, 1, 'distinct userId 기준 1');
});

test('서로 다른 userId 두 명이 yellow 면 distinct 2', () => {
  const a = member('a', { slots: slots([], [10]) });
  const b = member('b', { slots: slots([], [10]) });
  const res = recommendSlots(
    input({ members: [a, b], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].yellowMembers, 2);
});

// ==========================================================================
// 13. yellow 카운트 3단계(0<1<2) 오름차순 + yellow 가 첫 시간에 있는 경우
// ==========================================================================

test('yellowMembers 0 < 1 < 2 오름차순으로 정렬 (boolean 아니라 count)', () => {
  // 10: a,b 둘 다 green (yellow0). 11: a green / b yellow (yellow1). 12: a,b 둘 다 yellow (yellow2).
  const a = member('a', { slots: slots([10, 11], [12]) });
  const b = member('b', { slots: slots([10], [11, 12]) });
  const res = recommendSlots(
    input({ members: [a, b], candidateSlots: [10, 11, 12], durations: [1] }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.yellowMembers]),
    [
      [10, 0],
      [11, 1],
      [12, 2],
    ],
  );
});

test('yellow 가 window 첫 시간에 있어도 카운트된다 (마지막 시간만 보지 않음)', () => {
  // 10 yellow, 11 green. [10,12) -> yellow 1.
  const m = member('u1', { slots: slots([11], [10]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [2] }),
  );
  assert.equal(res[0].yellowMembers, 1);
});

// ==========================================================================
// 14. 사전식 우선순위 — 각 키가 start tie-break 와 독립으로 우선함을 증명
//     (적대적 검증: 기존 #16/#19 는 더 높은 점수 window 가 더 작은 start 라
//      start ASC 만으로도 통과했음. 여기선 더 높은 점수 window 를 더 큰 start 에 둔다.)
// ==========================================================================

test('continuity 가 start 보다 우선 (높은 continuity 가 더 큰 start 여도 먼저)', () => {
  // slots 10,12. existing [13,14) -> start 12 는 start+L(13)===existing.start -> cont 1.
  // start 10 은 cont 0. 스펙상 continuity DESC 가 start ASC 보다 우선 -> [12,10].
  const m = member('u1', {
    slots: slots([10, 12]),
    existing: [{ start: 13, end: 14 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, 12], durations: [1] }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.continuity]),
    [
      [12, 1],
      [10, 0],
    ],
    'continuity 1 인 start 12 가 continuity 0 인 start 10 보다 앞',
  );
});

test('roomAdjacency 가 start 보다 우선 (높은 roomAdj 가 더 큰 start 여도 먼저)', () => {
  // slots 10,14. roomIntervals [15,16) -> start 14 는 start+L(15)===room.start -> roomAdj 1.
  // start 10 은 roomAdj 0. 스펙상 roomAdj DESC 가 start ASC 보다 우선 -> [14,10].
  const m = member('u1', { slots: slots([10, 14]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [{ start: 15, end: 16 }],
      candidateSlots: [10, 14],
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.roomAdjacency]),
    [
      [14, 1],
      [10, 0],
    ],
    'roomAdjacency 1 인 start 14 가 roomAdjacency 0 인 start 10 보다 앞',
  );
});

test('continuity 가 roomAdjacency 보다 우선 (key 2 > key 3, 격리)', () => {
  // start 20: continuity 1 (existing [21,23) start===s+L===21), roomAdj 0.
  // start 10: continuity 0, roomAdjacency 1 (room [9,10) end===s===10).
  // 스펙: continuity > roomAdjacency -> start 20 먼저.
  const m = member('u1', {
    slots: slots([10, 20]),
    existing: [{ start: 21, end: 23 }],
  });
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [{ start: 9, end: 10 }],
      candidateSlots: [10, 20],
      durations: [1],
    }),
  );
  assert.deepEqual(
    res.map((r) => [r.start, r.continuity, r.roomAdjacency]),
    [
      [20, 1, 0],
      [10, 0, 1],
    ],
    'continuity 1 이 roomAdjacency 1 을 이긴다',
  );
});

test('yellow 가 큰 continuity 를 이긴다 (key 1 > key 2, 사전식 지배)', () => {
  // start 10: yellow 0, continuity 0.  start 12: yellow 1, continuity 5(인위적으로 크게).
  // 사전식: yellow 가 최우선 -> yellow0(start10) 이 yellow1(start12, cont5) 보다 앞.
  // continuity 를 크게: start 12 window([12,13)) 양옆에 여러 existing 경계.
  const m = member('u1', {
    slots: slots([10, 11], [12]),
    existing: [
      { start: 8, end: 12 }, // end===12===s -> cont +1 (앞붙음)
      { start: 13, end: 14 }, // start===13===s+L -> cont +1 (뒤붙음)
      { start: 13, end: 15 }, // start===13===s+L -> cont +1
      { start: 13, end: 16 }, // start===13===s+L -> cont +1
      { start: 8, end: 12 }, // end===12===s -> cont +1
    ],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, 12], durations: [1] }),
  );
  // start 10: yellow0, cont0.  start 12: yellow1, cont5.
  assert.equal(res[0].start, 10, 'yellow0 window 가 yellow1(cont 큰) 보다 우선');
  assert.equal(res[0].yellowMembers, 0);
  const byStart = Object.fromEntries(res.map((r) => [r.start, r]));
  assert.equal(byStart[12].yellowMembers, 1);
  assert.equal(byStart[12].continuity, 5, 'continuity 가 커도 yellow 에 밀린다');
});

// ==========================================================================
// 15. continuity / roomAdjacency 경계 — overlap 은 인접이 아니다 (시간 경계 인코딩)
// ==========================================================================

test('continuity: window 와 OVERLAP 하는 existing 은 0 (double-booked != back-to-back)', () => {
  // existing [10,12) 가 window [10,11) 과 겹침: start(10)!==s+L(11), end(12)!==s(10) -> 0.
  const m = member('u1', {
    slots: slots([10]),
    existing: [{ start: 10, end: 12 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res[0].continuity, 0, 'overlap 은 인접 카운트 아님');
});

test('엔진은 existing 과 겹쳐도 window 를 막지 않는다 (busy/roomBusy 만 하드필터)', () => {
  // existing [10,12) 가 있지만 busy 는 비어있음 -> [10,11) 은 여전히 유효 후보.
  // (로더 책임: existing rehearsal 시간을 busy 로 전개. 엔진은 existing 으로 차단 안 함.)
  const m = member('u1', {
    slots: slots([10, 11]),
    existing: [{ start: 10, end: 12 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1] }),
  );
  assert.equal(res.length, 1, 'existing overlap 은 엔진 하드필터가 아니다');
  assert.equal(res[0].start, 10);
});

test('roomAdjacency: window 와 OVERLAP 하는 roomInterval 은 0 (인접 아님)', () => {
  // room [10,12) 가 window [10,11) 과 겹침: 경계 불일치 -> roomAdj 0.
  const m = member('u1', { slots: slots([10]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [{ start: 10, end: 12 }],
      candidateSlots: [10],
      durations: [1],
    }),
  );
  assert.equal(res[0].roomAdjacency, 0);
});

test('roomIntervals 와 겹쳐도 roomBusy 에 없으면 window 는 유효 (roomIntervals 는 보너스 전용)', () => {
  // room interval [10,11) 겹치지만 roomBusy 는 비어있음 -> [10,11) 유효.
  const m = member('u1', { slots: slots([10]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [{ start: 10, end: 11 }],
      roomBusy: [],
      candidateSlots: [10],
      durations: [1],
    }),
  );
  assert.equal(res.length, 1, 'roomIntervals 는 하드필터가 아니다 (roomBusy 만)');
});

test('스펙 플래그십: 멤버 existing [21,22) 가 [19,21) 합주 직후면 continuity 1', () => {
  // 19,20 가용. [19,21) -> s+L=21. existing.start 21 === 21 -> 이어서 +1.
  const m = member('u1', {
    slots: slots([19, 20]),
    existing: [{ start: 21, end: 22 }],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [19], durations: [2] }),
  );
  assert.equal(res[0].continuity, 1, '19-21 합주 직후 21-22 기존 = 이어서');
});

test('roomAdjacency: 양옆 roomIntervals 합산 (s 직전 + s+L 직후 = 2)', () => {
  // window [10,12). room [9,10) end===s -> +1. room [12,13) start===s+L -> +1. 합 2.
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({
      members: [m],
      roomIntervals: [
        { start: 9, end: 10 },
        { start: 12, end: 13 },
      ],
      candidateSlots: [10],
      durations: [2],
    }),
  );
  assert.equal(res[0].roomAdjacency, 2);
});

test('continuity: 한 멤버 양옆 existing 을 2시간 window 양 경계에서 모두 합산', () => {
  // window [10,12). existing [8,10) end===s(+1) + [12,14) start===s+L(+1) = 2.
  const m = member('u1', {
    slots: slots([10, 11]),
    existing: [
      { start: 8, end: 10 },
      { start: 12, end: 14 },
    ],
  });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [2] }),
  );
  assert.equal(res[0].continuity, 2);
});

// ==========================================================================
// 16. 기타 가드 / 결정성
// ==========================================================================

test('빈 durations 배열은 []', () => {
  const m = member('u1', { slots: slots([10]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [] }),
  );
  assert.deepEqual(res, []);
});

test('음수 topK 는 [] (topK<=0 가드)', () => {
  const m = member('u1', { slots: slots([10, 11]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10], durations: [1], topK: -5 }),
  );
  assert.deepEqual(res, []);
});

test('빈 slots Map 멤버가 한 명이라도 있으면 교집합으로 [] (all-members 하드필터)', () => {
  const a = member('a', { slots: slots([10, 11]) });
  const b = member('b', { slots: new Map() }); // 가용 0
  const res = recommendSlots(
    input({ members: [a, b], candidateSlots: [10, 11], durations: [1] }),
  );
  assert.deepEqual(res, [], '한 멤버라도 가용 슬롯 없으면 후보 없음');
});

test('모든 점수 키 동률 + start 동률에서 duration DESC 가 최종 결정 키', () => {
  // start 10 에서 yellow/cont/room 모두 0, duration 1,2,3 (slots 10,11,12).
  const m = member('u1', { slots: slots([10, 11, 12]) });
  const res = recommendSlots(
    input({ members: [m], candidateSlots: [10, 10], durations: [1, 2, 3, 2] }),
  );
  assert.deepEqual(
    res.map((r) => r.duration),
    [3, 2, 1],
    '같은 start 에서 duration 내림차순',
  );
});
