// 캘린더 더블부킹 감지 테스트 (순수 JS ESM — .mjs)
// 실행: node --experimental-strip-types --test src/lib/calendar/conflicts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, detectConflicts } from './conflicts.ts';

function bk(id, start, end, type = 'rehearsal', members = []) {
  return { id, type, start, end, title: id, members };
}

// ───────────────────────── overlaps ─────────────────────────

test('overlaps: 겹치면 true', () => {
  assert.equal(overlaps(bk('a', 10, 13), bk('b', 12, 14)), true);
});

test('overlaps: half-open 경계 접촉은 비겹침(false)', () => {
  assert.equal(overlaps(bk('a', 10, 12), bk('b', 12, 14)), false);
  assert.equal(overlaps(bk('a', 12, 14), bk('b', 10, 12)), false);
});

test('overlaps: 완전 분리면 false', () => {
  assert.equal(overlaps(bk('a', 10, 12), bk('b', 20, 22)), false);
});

test('overlaps: 포함도 true', () => {
  assert.equal(overlaps(bk('a', 10, 20), bk('b', 12, 14)), true);
});

// ───────────────────────── detectConflicts ─────────────────────────

test('충돌 없음: 분리된 예약들', () => {
  const r = detectConflicts([bk('a', 10, 12), bk('b', 12, 14), bk('c', 14, 16)]);
  assert.equal(r.pairs.length, 0);
  assert.equal(r.conflictIds.size, 0);
  assert.equal(r.roomConflictIds.size, 0);
});

test('두 합주 겹침 → room 충돌(하드)', () => {
  const r = detectConflicts([bk('a', 10, 13), bk('b', 12, 15)]);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0].kind, 'room');
  assert.deepEqual([...r.roomConflictIds].sort(), ['a', 'b']);
  assert.deepEqual([...r.conflictIds].sort(), ['a', 'b']);
});

test('합주↔회의 겹침 → overlap(정보성), room 아님', () => {
  const r = detectConflicts([
    bk('reh', 10, 13, 'rehearsal'),
    bk('mtg', 12, 14, 'meeting'),
  ]);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0].kind, 'overlap');
  assert.equal(r.roomConflictIds.size, 0);
  assert.equal(r.conflictIds.size, 2);
});

test('회의끼리 겹침 → overlap (방 점유 없음)', () => {
  const r = detectConflicts([
    bk('m1', 10, 13, 'meeting'),
    bk('m2', 12, 14, 'meeting'),
  ]);
  assert.equal(r.pairs[0].kind, 'overlap');
  assert.equal(r.roomConflictIds.size, 0);
});

test('공유 멤버 보고: 교집합', () => {
  const r = detectConflicts([
    bk('a', 10, 13, 'rehearsal', ['u1', 'u2', 'u3']),
    bk('b', 12, 15, 'rehearsal', ['u2', 'u3', 'u4']),
  ]);
  assert.deepEqual(r.pairs[0].sharedMembers, ['u2', 'u3']);
});

test('공유 멤버 없으면 빈 배열(여전히 room 충돌)', () => {
  const r = detectConflicts([
    bk('a', 10, 13, 'rehearsal', ['u1']),
    bk('b', 12, 15, 'rehearsal', ['u2']),
  ]);
  assert.equal(r.pairs[0].kind, 'room');
  assert.deepEqual(r.pairs[0].sharedMembers, []);
});

test('3개 동시 겹침 → 쌍 3개(a-b, a-c, b-c)', () => {
  const r = detectConflicts([
    bk('a', 10, 16),
    bk('b', 11, 13),
    bk('c', 12, 14),
  ]);
  assert.equal(r.pairs.length, 3);
  assert.deepEqual([...r.conflictIds].sort(), ['a', 'b', 'c']);
});

test('쌍 순서: 입력 인덱스 i<j 로 결정적(a=먼저 등장)', () => {
  const r = detectConflicts([bk('first', 10, 14), bk('second', 11, 13)]);
  assert.equal(r.pairs[0].a, 'first');
  assert.equal(r.pairs[0].b, 'second');
});

test('빈 입력 / 단일 예약 → 충돌 없음', () => {
  assert.equal(detectConflicts([]).pairs.length, 0);
  assert.equal(detectConflicts([bk('a', 10, 12)]).pairs.length, 0);
});

test('한 예약이 여러 충돌에 연루', () => {
  // hub 가 a, b 둘 다와 겹침. a-b 는 분리.
  const r = detectConflicts([
    bk('hub', 10, 20),
    bk('a', 10, 12),
    bk('b', 18, 20),
  ]);
  assert.equal(r.pairs.length, 2); // hub-a, hub-b (a-b 분리)
  assert.ok(r.conflictIds.has('hub'));
  assert.ok(r.conflictIds.has('a'));
  assert.ok(r.conflictIds.has('b'));
});
