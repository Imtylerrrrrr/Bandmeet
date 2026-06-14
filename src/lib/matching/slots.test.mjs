import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  addMonths,
  dateHourToSlot,
  dateStrToDays,
  durationToHours,
  instantToSlot,
  isValidDate,
  kstDateStr,
  kstWeekday,
  monthGridDays,
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

test('addMonths: 일반/연경계/음수', () => {
  assert.equal(addMonths('2026-06-14', 1), '2026-07-14');
  assert.equal(addMonths('2026-06-14', -1), '2026-05-14');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-01-10', -1), '2025-12-10');
  assert.equal(addMonths('2026-06-14', 0), '2026-06-14');
});

test('addMonths: 말일 클램프(짧은 달로 이동)', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28'); // 2026 평년
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2026-05-31', 1), '2026-06-30');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29'); // 2028 윤년
});

test('monthGridDays: 일요일 시작, 7의 배수, 해당 달 전부 포함', () => {
  const days = monthGridDays('2026-06-14');
  assert.equal(days.length % 7, 0);
  assert.ok(days.length === 35 || days.length === 42);
  assert.equal(kstWeekday(days[0]), 0); // 첫 칸은 일요일
  assert.equal(kstWeekday(days[days.length - 1]), 6); // 마지막 칸은 토요일
  assert.ok(days.includes('2026-06-01'));
  assert.ok(days.includes('2026-06-30'));
  // 6월(30일) 전부 포함
  assert.equal(days.filter((d) => d.startsWith('2026-06')).length, 30);
  // 연속(인접 칸 1일 차)
  for (let i = 1; i < days.length; i++) {
    assert.equal(dateStrToDays(days[i]) - dateStrToDays(days[i - 1]), 1);
  }
});

test('monthGridDays: 1일이 일요일인 달은 앞 패딩 없음', () => {
  // 2026-03-01 은 일요일 → gridStart=03-01
  const days = monthGridDays('2026-03-10');
  assert.equal(days[0], '2026-03-01');
  assert.equal(kstWeekday('2026-03-01'), 0);
});

test('monthGridDays: 일요일 시작 평년 2월도 최소 35칸(28칸 4행 방지)', () => {
  // 2026-02-01 은 일요일, 28일 → 클램프 없으면 28칸. 최소 5주로 보정.
  assert.equal(kstWeekday('2026-02-01'), 0);
  const days = monthGridDays('2026-02-15');
  assert.equal(days.length, 35); // 4행이 아니라 5행
  assert.equal(days[0], '2026-02-01');
  assert.equal(kstWeekday(days[0]), 0);
  assert.equal(kstWeekday(days[days.length - 1]), 6);
  assert.equal(days.filter((d) => d.startsWith('2026-02')).length, 28); // 2월 전부
  assert.ok(days.includes('2026-03-01')); // 트레일링은 3월
});

test('isValidDate: 형식 + 달력 유효성', () => {
  assert.ok(isValidDate('2026-06-14'));
  assert.ok(isValidDate('2028-02-29')); // 윤년
  assert.ok(!isValidDate('2026-02-29')); // 평년 2/29 없음
  assert.ok(!isValidDate('2026-02-30'));
  assert.ok(!isValidDate('2026-13-45')); // 월/일 범위 밖
  assert.ok(!isValidDate('2026-00-10')); // 월 0
  assert.ok(!isValidDate('2026-06-00')); // 일 0
  assert.ok(!isValidDate('2026-6-14')); // 형식(자리수)
  assert.ok(!isValidDate('garbage'));
});
