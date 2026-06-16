// 인증 식별자 순수 로직 테스트 (ESM — .mjs)
// 실행: node --experimental-strip-types --test src/lib/auth/credentials.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, normalizeUsername, validateUsername } from './credentials.ts';

// ───────────────────────── isEmail ─────────────────────────

test('isEmail: 표준 이메일은 true', () => {
  assert.equal(isEmail('hong@band.com'), true);
  assert.equal(isEmail('a@b.co'), true);
});

test('isEmail: @ 없으면 false', () => {
  assert.equal(isEmail('hongband.com'), false);
});

test('isEmail: 도메인에 점 없으면 false', () => {
  assert.equal(isEmail('hong@band'), false);
});

test('isEmail: 공백 포함 false', () => {
  assert.equal(isEmail('a b@c.com'), false);
  assert.equal(isEmail('a@ b.com'), false);
});

test('isEmail: 빈 문자열 false', () => {
  assert.equal(isEmail(''), false);
});

// ─────────────────────── normalizeUsername ───────────────────────

test('normalizeUsername: 앞뒤 공백 제거 + 소문자화', () => {
  assert.equal(normalizeUsername('  Hong_123 '), 'hong_123');
  assert.equal(normalizeUsername('ABC'), 'abc');
  assert.equal(normalizeUsername('user_1'), 'user_1');
});

// ─────────────────────── validateUsername ───────────────────────

test('validateUsername: 유효하면 null', () => {
  assert.equal(validateUsername('hong_123'), null);
  assert.equal(validateUsername('abc'), null); // 최소 3자
  assert.equal(validateUsername('a'.repeat(20)), null); // 최대 20자
});

test('validateUsername: 너무 짧으면 에러', () => {
  assert.notEqual(validateUsername('ab'), null);
});

test('validateUsername: 너무 길면 에러', () => {
  assert.notEqual(validateUsername('a'.repeat(21)), null);
});

test('validateUsername: 허용 외 문자는 에러', () => {
  assert.notEqual(validateUsername('Hong'), null); // 대문자
  assert.notEqual(validateUsername('hong-kim'), null); // 하이픈
  assert.notEqual(validateUsername('hong.kim'), null); // 점
  assert.notEqual(validateUsername('hong kim'), null); // 공백
  assert.notEqual(validateUsername('한글이름'), null); // 비ASCII
});

test('validateUsername: 빈 문자열 에러', () => {
  assert.notEqual(validateUsername(''), null);
});
