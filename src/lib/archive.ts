// 아카이브(공연 종료) 읽기전용 가드 (빌드매뉴얼 11단계).
// 공연이 archived 면 그 하위(팀·곡·배치·투표) 변경을 서버에서 차단한다.
// UI 가 폼을 숨기더라도 서버 가드가 최종 안전망.

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { performances, songs, teams } from '@/lib/db/schema';

const ARCHIVED_MSG = '아카이브된 공연은 수정할 수 없습니다.';

/** 공연이 아카이브됐는지. */
export async function isPerfArchived(performanceId: string): Promise<boolean> {
  const [p] = await db
    .select({ archivedAt: performances.archivedAt })
    .from(performances)
    .where(eq(performances.id, performanceId));
  return !!p?.archivedAt;
}

export async function assertPerfActive(performanceId: string): Promise<void> {
  if (await isPerfArchived(performanceId)) throw new Error(ARCHIVED_MSG);
}

/** 팀 → 공연 아카이브 확인. */
export async function assertTeamActive(teamId: string): Promise<void> {
  const [t] = await db
    .select({ performanceId: teams.performanceId })
    .from(teams)
    .where(eq(teams.id, teamId));
  if (t) await assertPerfActive(t.performanceId);
}

/** 곡 → 팀 → 공연 아카이브 확인. */
export async function assertSongActive(songId: string): Promise<void> {
  const [s] = await db.select({ teamId: songs.teamId }).from(songs).where(eq(songs.id, songId));
  if (s) await assertTeamActive(s.teamId);
}

/** 팀의 소속 공연이 아카이브됐는지(UI 플래그용). */
export async function isTeamArchived(teamId: string): Promise<boolean> {
  const [t] = await db
    .select({ performanceId: teams.performanceId })
    .from(teams)
    .where(eq(teams.id, teamId));
  return t ? isPerfArchived(t.performanceId) : false;
}

/** 곡의 소속 공연이 아카이브됐는지(UI 플래그용). */
export async function isSongArchived(songId: string): Promise<boolean> {
  const [s] = await db.select({ teamId: songs.teamId }).from(songs).where(eq(songs.id, songId));
  return s ? isTeamArchived(s.teamId) : false;
}
