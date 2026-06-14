// 투표 집계 + 빈 슬롯 선택 테스트 (순수 JS ESM — .mjs)
// 실행: node --experimental-strip-types --test src/lib/matching/tally.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallyVotes, isFree, pickWinner } from './tally.ts';

// ---- 헬퍼 ----
function opt(id, start, duration = 2) {
  return { id, start, duration };
}
function ballot(optionId, rank) {
  return { optionId, rank };
}
// id -> TalliedOption 빠른 조회
function byId(tallied) {
  const m = new Map();
  for (const t of tallied) m.set(t.id, t);
  return m;
}

// ───────────────────────── tallyVotes ─────────────────────────

test('빈 표: 모든 옵션 score 0, 입력 옵션 전부 포함', () => {
  const res = tallyVotes([opt('a', 10), opt('b', 20)], []);
  assert.equal(res.length, 2);
  for (const t of res) {
    assert.equal(t.score, 0);
    assert.equal(t.first, 0);
    assert.equal(t.second, 0);
    assert.equal(t.third, 0);
  }
});

test('Borda 가중치: 1순위=3, 2순위=2, 3순위=1', () => {
  const res = byId(
    tallyVotes(
      [opt('a', 10), opt('b', 20)],
      [
        ballot('a', 1), // +3
        ballot('a', 2), // +2 (다른 유저)
        ballot('b', 3), // +1
      ],
    ),
  );
  assert.equal(res.get('a').score, 5);
  assert.equal(res.get('a').first, 1);
  assert.equal(res.get('a').second, 1);
  assert.equal(res.get('b').score, 1);
  assert.equal(res.get('b').third, 1);
});

test('정렬: score 내림차순이 최우선', () => {
  const res = tallyVotes(
    [opt('lo', 10), opt('hi', 20)],
    [ballot('hi', 1), ballot('lo', 3)],
  );
  assert.equal(res[0].id, 'hi'); // 3점 > 1점
  assert.equal(res[1].id, 'lo');
});

test('정렬 동점 tie1: first(1순위 표) 많은 쪽 우선', () => {
  // a: 1순위2개 = 6점. b: 2순위3개 = 6점. 동점이면 first 많은 a.
  const res = tallyVotes(
    [opt('a', 10), opt('b', 20)],
    [
      ballot('a', 1),
      ballot('a', 1),
      ballot('b', 2),
      ballot('b', 2),
      ballot('b', 2),
    ],
  );
  assert.equal(res[0].id, 'a');
});

test('정렬 동점 tie2: score·first 동률이면 이른 start 우선', () => {
  const res = tallyVotes(
    [opt('late', 30), opt('early', 10)],
    [ballot('late', 1), ballot('early', 1)],
  );
  assert.equal(res[0].id, 'early');
});

test('정렬 동점 tie3: start 까지 동률이면 긴 duration 우선', () => {
  const res = tallyVotes(
    [opt('short', 10, 1), opt('long', 10, 2)],
    [ballot('short', 1), ballot('long', 1)],
  );
  assert.equal(res[0].id, 'long');
});

test('정렬 완전 동률: id 사전순 (결정성)', () => {
  const res = tallyVotes([opt('b', 10, 2), opt('a', 10, 2)], []);
  assert.equal(res[0].id, 'a');
  assert.equal(res[1].id, 'b');
});

test('이 투표에 없는 optionId 표는 무시', () => {
  const res = byId(tallyVotes([opt('a', 10)], [ballot('a', 1), ballot('ghost', 1)]));
  assert.equal(res.get('a').score, 3);
  assert.equal(res.size, 1);
});

test('rank 가 1·2·3 외면 무효표로 무시', () => {
  const res = byId(
    tallyVotes(
      [opt('a', 10)],
      [ballot('a', 0), ballot('a', 4), ballot('a', -1), ballot('a', 2)],
    ),
  );
  assert.equal(res.get('a').score, 2); // 유효한 2순위 1표만
  assert.equal(res.get('a').second, 1);
});

// ───────────────────────── isFree ─────────────────────────

test('isFree: 겹치는 구간이 없으면 true', () => {
  assert.equal(isFree(10, 12, [{ start: 14, end: 16 }]), true);
});

test('isFree: half-open 경계 접촉은 안 겹침(true)', () => {
  // [10,12) 와 [12,14) 는 12 에서 닿지만 half-open 이라 비겹침.
  assert.equal(isFree(10, 12, [{ start: 12, end: 14 }]), true);
  assert.equal(isFree(12, 14, [{ start: 10, end: 12 }]), true);
});

test('isFree: 1시간이라도 겹치면 false', () => {
  assert.equal(isFree(10, 13, [{ start: 12, end: 14 }]), false); // 12 겹침
});

test('isFree: 포함(occupied 가 더 큼)도 false', () => {
  assert.equal(isFree(11, 12, [{ start: 10, end: 14 }]), false);
});

test('isFree: occupied 여러 개 중 하나라도 겹치면 false', () => {
  const occ = [
    { start: 0, end: 5 },
    { start: 20, end: 22 },
    { start: 11, end: 12 },
  ];
  assert.equal(isFree(10, 13, occ), false);
});

test('isFree: occupied 비면 항상 true', () => {
  assert.equal(isFree(10, 12, []), true);
});

// ───────────────────────── pickWinner ─────────────────────────

test('pickWinner: 최상위가 비어있으면 그것을 선택', () => {
  const tallied = tallyVotes(
    [opt('top', 10), opt('snd', 20)],
    [ballot('top', 1), ballot('snd', 3)],
  );
  const w = pickWinner(tallied, []);
  assert.equal(w.id, 'top');
});

test('pickWinner: 1순위 옵션이 점유면 2순위로 캐스케이드', () => {
  const tallied = tallyVotes(
    [opt('top', 10), opt('snd', 20)],
    [ballot('top', 1), ballot('snd', 3)],
  );
  // top=[10,12) 점유 → snd 선택.
  const w = pickWinner(tallied, [{ start: 10, end: 12 }]);
  assert.equal(w.id, 'snd');
});

test('pickWinner: 모든 옵션 점유면 null', () => {
  const tallied = tallyVotes([opt('a', 10), opt('b', 20)], []);
  const w = pickWinner(tallied, [
    { start: 10, end: 12 },
    { start: 20, end: 22 },
  ]);
  assert.equal(w, null);
});

test('pickWinner: 옵션이 없으면 null', () => {
  assert.equal(pickWinner([], []), null);
});

test('pickWinner: 경계만 닿는 점유는 빈 슬롯으로 인정', () => {
  const tallied = tallyVotes([opt('a', 12)], []); // [12,14)
  const w = pickWinner(tallied, [{ start: 10, end: 12 }]); // 12 에서 접촉
  assert.equal(w.id, 'a');
});

test('pickWinner: 점수 낮아도 빈 슬롯이면 선택(점유 우회)', () => {
  // top 점유, mid 점유, low 만 빈 슬롯.
  const tallied = tallyVotes(
    [opt('top', 10), opt('mid', 20), opt('low', 30)],
    [ballot('top', 1), ballot('mid', 2), ballot('low', 3)],
  );
  const w = pickWinner(tallied, [
    { start: 10, end: 12 },
    { start: 20, end: 22 },
  ]);
  assert.equal(w.id, 'low');
});
