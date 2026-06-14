// 라이브 DB 스모크: 캘린더 로더 + 충돌 감지 (8단계).
// 실행: node --experimental-strip-types --import ./scripts/register.mjs scripts/smoke-calendar.mjs
import { randomUUID, randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  orgs,
  profiles,
  performances,
  teams,
  songs,
  songMembers,
  rehearsals,
  meetings,
} from '@/lib/db/schema';
import { loadOrgWeek, loadPersonalWeek } from '@/lib/calendar/load';
import { detectConflicts } from '@/lib/calendar/conflicts';
import { dateHourToSlot, slotToDate } from '@/lib/matching/slots';

const at = (dateStr, hour) => slotToDate(dateHourToSlot(dateStr, hour));
const WEEK_START = '2026-07-05'; // 일요일
const MON = '2026-07-06';
const TUE = '2026-07-07';
const NEXT_MON = '2026-07-13'; // 다음 주

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

async function makeOrg() {
  const orgId = randomUUID();
  await db.insert(orgs).values({
    id: orgId,
    name: 'SMOKECAL ' + orgId.slice(0, 8),
    inviteCode: randomBytes(5).toString('hex'),
  });
  createdOrgs.push(orgId);
  const perfId = randomUUID();
  await db.insert(performances).values({ id: perfId, orgId, name: 'P' });
  const teamId = randomUUID();
  await db.insert(teams).values({ id: teamId, orgId, performanceId: perfId, name: 'T' });
  return { orgId, teamId };
}

async function makeSong(orgId, teamId, title, memberIds = []) {
  const songId = randomUUID();
  await db.insert(songs).values({ id: songId, orgId, teamId, title });
  if (memberIds.length) {
    await db.insert(songMembers).values(memberIds.map((userId) => ({ songId, userId })));
  }
  return songId;
}

async function confirmReh(orgId, songId, dateStr, hour, dur) {
  const id = randomUUID();
  await db.insert(rehearsals).values({
    id,
    orgId,
    songId,
    startAt: at(dateStr, hour),
    durationMin: dur * 60,
    status: 'confirmed',
  });
  return id;
}

async function makeMeeting(orgId, title, dateStr, hour, dur) {
  const id = randomUUID();
  await db.insert(meetings).values({ id, orgId, title, startAt: at(dateStr, hour), durationMin: dur * 60 });
  return id;
}

async function main() {
  const [u] = await db.select({ id: profiles.id }).from(profiles).limit(1);
  if (!u) throw new Error('기존 프로필 없음(카카오 로그인 1회 필요).');
  const uid = u.id;

  const { orgId, teamId } = await makeOrg();
  const song1 = await makeSong(orgId, teamId, '곡1', [uid]);
  const song2 = await makeSong(orgId, teamId, '곡2', [uid]);
  const song3 = await makeSong(orgId, teamId, '곡3', []); // 내가 없는 곡

  const R1 = await confirmReh(orgId, song1, MON, 14, 2); // 월 14–16
  const R2 = await confirmReh(orgId, song2, MON, 15, 2); // 월 15–17 → R1 과 방 중복
  const R3 = await confirmReh(orgId, song3, TUE, 14, 2); // 화 14–16 (내 곡 아님)
  const M1 = await makeMeeting(orgId, '정기회의', MON, 16, 2); // 월 16–18 → R2 와 겹침
  const RN = await confirmReh(orgId, song1, NEXT_MON, 14, 2); // 다음 주 → 이번 주 제외

  // ── 룸 마스터 주간 ──
  const org = await loadOrgWeek(orgId, WEEK_START);
  const ids = new Set(org.bookings.map((b) => b.id));
  check('룸: 이번 주 예약 4건(R1·R2·R3·M1)', org.bookings.length === 4);
  check('룸: 다음 주 합주 제외', !ids.has(RN));
  check('룸: R1·R2·R3·M1 포함', [R1, R2, R3, M1].every((x) => ids.has(x)));
  const mtg = org.bookings.find((b) => b.id === M1);
  check('룸: 회의 type=meeting, members=[]', mtg?.type === 'meeting' && mtg.members.length === 0);
  const r2 = org.bookings.find((b) => b.id === R2);
  check('룸: R2 members 에 내 uid 포함', r2?.members.includes(uid));
  check('룸: nameById 에 참여자 이름 존재', org.nameById.has(uid));

  const rep = detectConflicts(org.bookings);
  check('충돌: R1↔R2 방 중복', rep.roomConflictIds.has(R1) && rep.roomConflictIds.has(R2));
  check('충돌: R2↔M1 시간 겹침(방 중복 아님)', rep.conflictIds.has(M1) && !rep.roomConflictIds.has(M1));
  check('충돌: R3 는 충돌 없음', !rep.conflictIds.has(R3));
  const roomPair = rep.pairs.find((p) => p.kind === 'room');
  check('충돌: 방 중복 쌍의 공통 멤버에 uid', roomPair?.sharedMembers.includes(uid));

  // ── 개인 통합 주간 ──
  const me = await loadPersonalWeek(orgId, uid, WEEK_START);
  const myIds = new Set(me.bookings.map((b) => b.id));
  check('개인: 내 곡 합주 R1·R2 포함', myIds.has(R1) && myIds.has(R2));
  check('개인: 내가 없는 곡 R3 제외', !myIds.has(R3));
  check('개인: 회의 M1 포함', myIds.has(M1));
  check('개인: 다음 주 제외', !myIds.has(RN));
  check('개인: 총 3건(R1·R2·M1)', me.bookings.length === 3);
}

async function cleanup() {
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
