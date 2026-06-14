// 라이브 스모크: 아카이브 읽기전용 가드 (11단계).
// 실행: node --experimental-strip-types --import ./scripts/register.mjs scripts/smoke-archive.mjs
import { randomUUID, randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { orgs, performances, teams, songs } from '@/lib/db/schema';
import {
  assertPerfActive,
  assertTeamActive,
  assertSongActive,
  isPerfArchived,
  isTeamArchived,
  isSongArchived,
} from '@/lib/archive';

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
async function throws(fn) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const orgId = randomUUID();
  await db.insert(orgs).values({ id: orgId, name: 'SMOKEARC', inviteCode: randomBytes(5).toString('hex') });
  createdOrgs.push(orgId);
  const perfId = randomUUID();
  await db.insert(performances).values({ id: perfId, orgId, name: 'P' });
  const teamId = randomUUID();
  await db.insert(teams).values({ id: teamId, orgId, performanceId: perfId, name: 'T' });
  const songId = randomUUID();
  await db.insert(songs).values({ id: songId, orgId, teamId, title: 'S' });

  // ── 활성(아카이브 전) ──
  check('활성: isPerfArchived=false', (await isPerfArchived(perfId)) === false);
  check('활성: assertPerfActive 통과', !(await throws(() => assertPerfActive(perfId))));
  check('활성: assertTeamActive 통과', !(await throws(() => assertTeamActive(teamId))));
  check('활성: assertSongActive 통과', !(await throws(() => assertSongActive(songId))));

  // ── 아카이브 ──
  await db.update(performances).set({ archivedAt: new Date() }).where(eq(performances.id, perfId));
  check('아카이브: isPerfArchived=true', (await isPerfArchived(perfId)) === true);
  check('아카이브: isTeamArchived=true (팀→공연 해석)', (await isTeamArchived(teamId)) === true);
  check('아카이브: isSongArchived=true (곡→팀→공연 해석)', (await isSongArchived(songId)) === true);
  check('아카이브: assertPerfActive 차단', await throws(() => assertPerfActive(perfId)));
  check('아카이브: assertTeamActive 차단', await throws(() => assertTeamActive(teamId)));
  check('아카이브: assertSongActive 차단', await throws(() => assertSongActive(songId)));

  // ── 복원 ──
  await db.update(performances).set({ archivedAt: null }).where(eq(performances.id, perfId));
  check('복원: isPerfArchived=false', (await isPerfArchived(perfId)) === false);
  check('복원: assertSongActive 다시 통과', !(await throws(() => assertSongActive(songId))));
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
