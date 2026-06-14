// 라이브 DB 스모크: closeDueVotes (7단계 투표 마감 자동확정).
// 실행: node --experimental-strip-types --import ./scripts/register.mjs scripts/smoke-close.mjs
import { randomUUID, randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  orgs,
  profiles,
  performances,
  teams,
  songs,
  rehearsals,
  rehearsalVotes,
  rehearsalVoteOptions,
  rehearsalVoteBallots,
} from '@/lib/db/schema';
import { closeDueVotes } from '@/lib/matching/close';
import { dateHourToSlot, slotToDate } from '@/lib/matching/slots';

const D = '2026-07-01'; // 미래(now=2026-06-14 이후) band 날짜
const at = (hour) => slotToDate(dateHourToSlot(D, hour)); // KST 정시 Date
const PAST = new Date('2026-06-01T00:00:00Z'); // 마감 지남
const FUTURE = new Date('2026-12-31T00:00:00Z'); // 아직 안 지남

const createdOrgs = [];
let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

// org 구조 뼈대(performance→team→song) 생성, songId 반환.
async function makeOrg() {
  const orgId = randomUUID();
  await db.insert(orgs).values({
    id: orgId,
    name: 'SMOKE ' + orgId.slice(0, 8),
    inviteCode: randomBytes(5).toString('hex'),
  });
  createdOrgs.push(orgId);
  const perfId = randomUUID();
  await db.insert(performances).values({ id: perfId, orgId, name: 'P' });
  const teamId = randomUUID();
  await db.insert(teams).values({ id: teamId, orgId, performanceId: perfId, name: 'T' });
  const songId = randomUUID();
  await db.insert(songs).values({ id: songId, orgId, teamId, title: 'S' });
  return { orgId, songId };
}

// voting 합주 + 투표 + 옵션들 생성. options=[{hour,dur}], closeAt.
async function makeVote(orgId, songId, options, closeAt) {
  const rehId = randomUUID();
  await db.insert(rehearsals).values({
    id: rehId,
    orgId,
    songId,
    startAt: at(options[0].hour),
    durationMin: options[0].dur * 60,
    status: 'voting',
  });
  const voteId = randomUUID();
  await db.insert(rehearsalVotes).values({ id: voteId, rehearsalId: rehId, voteCloseAt: closeAt });
  const optRows = options.map((o) => ({
    id: randomUUID(),
    voteId,
    slotStart: at(o.hour),
    durationMin: o.dur * 60,
  }));
  await db.insert(rehearsalVoteOptions).values(optRows);
  return { rehId, optRows };
}

// 확정 합주(점유) 생성.
async function occupy(orgId, songId, hour, dur) {
  await db.insert(rehearsals).values({
    id: randomUUID(),
    orgId,
    songId,
    startAt: at(hour),
    durationMin: dur * 60,
    status: 'confirmed',
  });
}

async function ballot(optionId, userId, rank) {
  await db.insert(rehearsalVoteBallots).values({ optionId, userId, rank });
}

async function rehStatus(rehId) {
  const [r] = await db
    .select({ status: rehearsals.status, startAt: rehearsals.startAt, durationMin: rehearsals.durationMin })
    .from(rehearsals)
    .where(eq(rehearsals.id, rehId));
  return r;
}

async function main() {
  // 투표자 = 기존 실제 프로필 1명 재사용(profiles.id 는 auth.users FK라 임의 생성 불가).
  // 한 유저가 서로 다른 옵션에 각각 순위를 매길 수 있어(PK=optionId,userId) 단일 유저로 충분.
  const [u] = await db.select({ id: profiles.id }).from(profiles).limit(1);
  if (!u) throw new Error('테스트할 기존 프로필이 없습니다(카카오 로그인 1회 필요).');
  const u1 = u.id;

  // ── S1 happy: optB(1순위) > optA(2순위) → optB(16시) 확정 ──
  const s1 = await makeOrg();
  const v1 = await makeVote(s1.orgId, s1.songId, [
    { hour: 14, dur: 2 }, // optA
    { hour: 16, dur: 2 }, // optB
    { hour: 18, dur: 2 }, // optC
  ], PAST);
  const [a1, b1] = v1.optRows;
  await ballot(b1.id, u1, 1); // optB 1순위 = 3점
  await ballot(a1.id, u1, 2); // optA 2순위 = 2점 (같은 유저, 다른 옵션)

  // ── S2 cascade: optA 최다지만 14시 점유 → optB(16시) ──
  const s2 = await makeOrg();
  const v2 = await makeVote(s2.orgId, s2.songId, [
    { hour: 14, dur: 2 }, // optA (top)
    { hour: 16, dur: 2 }, // optB
  ], PAST);
  const [a2] = v2.optRows;
  await ballot(a2.id, u1, 1); // optA top
  await occupy(s2.orgId, s2.songId, 14, 2); // 14–16 점유 → optA 막힘

  // ── S3 all-taken: 두 옵션 다 점유 → conflict ──
  const s3 = await makeOrg();
  const v3 = await makeVote(s3.orgId, s3.songId, [
    { hour: 14, dur: 2 },
    { hour: 16, dur: 2 },
  ], PAST);
  await occupy(s3.orgId, s3.songId, 14, 2);
  await occupy(s3.orgId, s3.songId, 16, 2);

  // ── S4 no-votes: 표 0개 → 이른 옵션(14시) 자동확정 ──
  const s4 = await makeOrg();
  const v4 = await makeVote(s4.orgId, s4.songId, [
    { hour: 14, dur: 2 },
    { hour: 16, dur: 2 },
  ], PAST);

  // ── S5 not-due: 마감 미래 → 그대로 voting ──
  const s5 = await makeOrg();
  const v5 = await makeVote(s5.orgId, s5.songId, [{ hour: 14, dur: 2 }], FUTURE);

  // ── S6 competing(같은 org, 두 투표가 14시 경합) → 서로 다른 슬롯 ──
  const s6 = await makeOrg();
  const v6a = await makeVote(s6.orgId, s6.songId, [
    { hour: 14, dur: 2 }, // top
    { hour: 18, dur: 2 },
  ], PAST);
  const v6b = await makeVote(s6.orgId, s6.songId, [
    { hour: 14, dur: 2 }, // top
    { hour: 20, dur: 2 },
  ], PAST);
  await ballot(v6a.optRows[0].id, u1, 1); // R1 top=14
  await ballot(v6b.optRows[0].id, u1, 1); // R2 top=14 (다른 투표의 다른 옵션이라 같은 유저 OK)

  // ── 실행 ──
  const now = new Date('2026-06-14T00:00:00Z');
  const summary = await closeDueVotes(now);
  console.log('\nsummary:', JSON.stringify(summary.bySeverity ?? {}), {
    processed: summary.processed,
    confirmed: summary.confirmed,
    conflicts: summary.conflicts,
  });

  // ── 검증 ──
  const r1 = await rehStatus(v1.rehId);
  check('S1 happy: confirmed', r1.status === 'confirmed');
  check('S1 happy: optB(16시) 확정', r1.startAt.getTime() === at(16).getTime());
  check('S1 happy: 원본 duration(120분) 보존', r1.durationMin === 120);

  const r2 = await rehStatus(v2.rehId);
  check('S2 cascade: confirmed', r2.status === 'confirmed');
  check('S2 cascade: 점유 우회해 optB(16시)', r2.startAt.getTime() === at(16).getTime());

  const r3 = await rehStatus(v3.rehId);
  check('S3 all-taken: conflict 플래그', r3.status === 'conflict');

  const r4 = await rehStatus(v4.rehId);
  check('S4 no-votes: confirmed', r4.status === 'confirmed');
  check('S4 no-votes: 이른 옵션(14시) 선택', r4.startAt.getTime() === at(14).getTime());

  const r5 = await rehStatus(v5.rehId);
  check('S5 not-due: 그대로 voting', r5.status === 'voting');

  const r6a = await rehStatus(v6a.rehId);
  const r6b = await rehStatus(v6b.rehId);
  check('S6 competing: 둘 다 confirmed', r6a.status === 'confirmed' && r6b.status === 'confirmed');
  check(
    'S6 competing: 같은 슬롯 더블부킹 없음(서로 다른 시각)',
    r6a.startAt.getTime() !== r6b.startAt.getTime(),
  );
  check(
    'S6 competing: 한쪽만 14시 점유',
    [r6a, r6b].filter((r) => r.startAt.getTime() === at(14).getTime()).length === 1,
  );

  check('processed=6 (S1·S2·S3·S4 + S6 둘; S5 미래 제외)', summary.processed === 6);
  check('confirmed=5', summary.confirmed === 5);
  check('conflicts=1', summary.conflicts === 1);
}

async function cleanup() {
  // org 삭제 → cascade: performances/teams/songs/rehearsals/votes/options/ballots.
  // 기존 실제 프로필은 건드리지 않는다(ballots 는 옵션 cascade 로 정리됨).
  if (createdOrgs.length) await db.delete(orgs).where(inArray(orgs.id, createdOrgs));
}

try {
  await main();
} catch (e) {
  fail++;
  console.error('THREW:', e);
} finally {
  await cleanup().catch((e) => console.error('cleanup failed:', e));
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
