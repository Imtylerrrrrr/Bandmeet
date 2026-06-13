import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  dateHourToSlot,
  dateStrToDays,
  durationToHours,
  instantToSlot,
  kstDateStr,
  kstWeekday,
  slotToDate,
} from './slots.ts';

test('같은 날 연속 시는 연속 정수 slot', () => {
  const a = dateHourToSlot('2026-06-15', 19);
  assert.equal(dateHourToSlot('2026-06-15', 20), a + 1);
  assert.equal(dateHourToSlot('2026-06-15', 21), a + 2);
});

test('하루 경계: 23시 +1 = 다음날 0시', () => {
  assert.equal(dateHourToSlot('2026-06-15', 23) + 1, dateHourToSlot('2026-06-16', 0));
});

test('KST 매핑: 2026-06-15 19:00 KST = 10:00 UTC', () => {
  const slot = dateHourToSlot('2026-06-15', 19);
  assert.equal(slot, instantToSlot(new Date('2026-06-15T10:00:00Z')));
});

test('slotToDate 왕복: slot → 인스턴트 → 같은 KST 날짜/시', () => {
  const slot = dateHourToSlot('2026-06-15', 19);
  const d = slotToDate(slot);
  assert.equal(kstDateStr(d), '2026-06-15');
  assert.equal(instantToSlot(d), slot);
  // 그 인스턴트의 UTC 시는 10시 (19 - 9).
  assert.equal(d.toISOString(), '2026-06-15T10:00:00.000Z');
});

test('instantToSlot 내림: 정시 중간도 같은 slot', () => {
  const slot = dateHourToSlot('2026-06-15', 19);
  assert.equal(instantToSlot(new Date('2026-06-15T10:30:00Z')), slot); // 19:30 KST → 19시 slot
  assert.equal(instantToSlot(new Date('2026-06-15T10:59:59Z')), slot);
  assert.equal(instantToSlot(new Date('2026-06-15T11:00:00Z')), slot + 1);
});

test('durationToHours: 올림, 최소 1', () => {
  assert.equal(durationToHours(60), 1);
  assert.equal(durationToHours(90), 2);
  assert.equal(durationToHours(120), 2);
  assert.equal(durationToHours(30), 1);
  assert.equal(durationToHours(0), 1);
  assert.equal(durationToHours(121), 3);
});

test('kstWeekday: 1970-01-01=목(4), 01-04=일(0)', () => {
  assert.equal(kstWeekday('1970-01-01'), 4);
  assert.equal(kstWeekday('1970-01-04'), 0);
  assert.equal(kstWeekday('1970-01-05'), 1); // 월
});

test('addDays: 일반/월경계/연경계/음수', () => {
  assert.equal(addDays('2026-06-15', 1), '2026-06-16');
  assert.equal(addDays('2026-06-15', 7), '2026-06-22');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01'); // 2026 평년
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-06-15', -1), '2026-06-14');
  assert.equal(addDays('2026-06-15', 0), '2026-06-15');
});

test('dateStrToDays 단조 증가, 1일 차이=1', () => {
  assert.equal(dateStrToDays('2026-06-16') - dateStrToDays('2026-06-15'), 1);
  assert.ok(dateStrToDays('2026-06-15') < dateStrToDays('2026-12-31'));
});

test('2시간 window 22:00 시작은 band 안(22,23), 23:00 시작은 24시(밤)로 새 band 밖', () => {
  // band [10,24): 22,23 가용 가능 / 24(=다음날 0)는 band 밖
  const s22 = dateHourToSlot('2026-06-15', 22);
  // 22시 2시간 = slot 22, 23 → 둘 다 같은 날 band
  assert.equal(kstDateStr(slotToDate(s22)), '2026-06-15');
  assert.equal(kstDateStr(slotToDate(s22 + 1)), '2026-06-15');
  // 23시 2시간 = slot 23, 24(=다음날 0시) → 24는 다음날, band(10~23) 밖
  const s23 = dateHourToSlot('2026-06-15', 23);
  assert.equal(kstDateStr(slotToDate(s23 + 1)), '2026-06-16');
});
