// 라이브 스모크: 사설 봇 API (10단계).
// 실행: node --experimental-strip-types --import ./scripts/register.mjs scripts/smoke-bot.mjs
import { randomUUID, randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  orgs,
  performances,
  teams,
  songs,
  rehearsals,
  outbox,
  chatBindings,
} from '@/lib/db/schema';
import { resolveOrgByRoom, scheduleText } from '@/lib/bot';
import { dateHourToSlot, kstDateStr, slotToDate } from '@/lib/matching/slots';

const at = (dateStr, hour) => slotToDate(dateHourToSlot(dateStr, hour));
// 실제 now 기준 ~3일 뒤(스케줄 7일 지평 안). HTTP 라우트도 real now 사용 → 일관.
const SOON = kstDateStr(new Date(Date.now() + 3 * 86400000));
const ROOM = 'SMOKEBOT_' + randomBytes(4).toString('hex');
const BASE = 'http://localhost:3000';
const SECRET = process.env.BOT_SECRET;

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

async function main() {
  const orgId = randomUUID();
  await db.insert(orgs).values({ id: orgId, name: 'SMOKEBOT', inviteCode: randomBytes(5).toString('hex') });
  createdOrgs.push(orgId);
  const perfId = randomUUID();
  await db.insert(performances).values({ id: perfId, orgId, name: 'P' });
  const teamId = randomUUID();
  await db.insert(teams).values({ id: teamId, orgId, performanceId: perfId, name: 'T' });
  const songId = randomUUID();
  await db.insert(songs).values({ id: songId, orgId, teamId, title: 'BotSong' });
  await db.insert(rehearsals).values({
    id: randomUUID(),
    orgId,
    songId,
    startAt: at(SOON, 14),
    durationMin: 120,
    status: 'confirmed',
  });
  await db.insert(chatBindings).values({ id: randomUUID(), orgId, roomName: ROOM });
  const ob1 = randomUUID();
  const ob2 = randomUUID();
  await db.insert(outbox).values([
    { id: ob1, orgId, body: '메시지1' },
    { id: ob2, orgId, body: '메시지2' },
  ]);

  // ── lib 직접 테스트 ──
  check('resolveOrgByRoom: 바인딩된 방 → orgId', (await resolveOrgByRoom(ROOM)) === orgId);
  check('resolveOrgByRoom: 없는 방 → null', (await resolveOrgByRoom('없는방')) === null);
  const sched = await scheduleText(orgId, new Date());
  check('scheduleText: 확정 합주 곡명 포함', sched.includes('BotSong'));

  // ── HTTP 라우트 테스트 (dev 서버) ──
  let alive = false;
  try {
    await fetch(BASE + '/login', { signal: AbortSignal.timeout(3000) });
    alive = true;
  } catch {
    console.log('  (dev 서버 미응답 — HTTP 라우트 테스트 스킵)');
  }

  if (alive && SECRET) {
    const auth = { Authorization: 'Bearer ' + SECRET };

    const noAuth = await fetch(`${BASE}/api/bot/poll?room=${encodeURIComponent(ROOM)}`);
    check('poll: 인증 없으면 401', noAuth.status === 401);

    const pollRes = await fetch(`${BASE}/api/bot/poll?room=${encodeURIComponent(ROOM)}`, { headers: auth });
    const pollData = await pollRes.json();
    check('poll: 미발송 2건 반환', pollData.messages?.length === 2);

    const ackRes = await fetch(`${BASE}/api/bot/ack`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pollData.messages.map((m) => m.id) }),
    });
    check('ack: ok', (await ackRes.json()).ok === true);

    const pollRes2 = await fetch(`${BASE}/api/bot/poll?room=${encodeURIComponent(ROOM)}`, { headers: auth });
    check('poll(재): ack 후 0건', (await pollRes2.json()).messages?.length === 0);

    const schedRes = await fetch(`${BASE}/api/bot/schedule?room=${encodeURIComponent(ROOM)}`, { headers: auth });
    check('schedule: 곡명 포함 텍스트', (await schedRes.json()).text?.includes('BotSong'));

    const schedUnbound = await fetch(`${BASE}/api/bot/schedule?room=없는방xyz`, { headers: auth });
    check('schedule: 미바인딩 방 안내', (await schedUnbound.json()).text?.includes('연결'));
  } else if (alive && !SECRET) {
    console.log('  (.env.local BOT_SECRET 없음 — HTTP 인증 테스트 스킵)');
  }
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
