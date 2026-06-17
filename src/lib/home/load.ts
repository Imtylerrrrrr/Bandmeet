// 홈 상태 카드용 집계. 네비 복제 대신 '다음 행동'을 보여주기 위한 가벼운 카운트.

import { and, count, eq, gte, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  memberships,
  rehearsalVoteBallots,
  rehearsalVoteOptions,
  rehearsalVotes,
  rehearsals,
  songMembers,
  songs,
} from '@/lib/db/schema';

export interface HomeStats {
  memberCount: number;
  pendingVotes: number; // 내가 아직 안 한, 마감 전 투표 수
  next: { title: string; startAt: Date } | null; // 내 다음 확정 합주
}

export async function loadHomeStats(
  orgId: string,
  userId: string,
): Promise<HomeStats> {
  const [mc] = await db
    .select({ n: count() })
    .from(memberships)
    .where(eq(memberships.orgId, orgId));
  const memberCount = mc?.n ?? 0;

  const mySongRows = await db
    .select({ songId: songMembers.songId })
    .from(songMembers)
    .where(eq(songMembers.userId, userId));
  const mySongIds = mySongRows.map((r) => r.songId);

  if (mySongIds.length === 0) {
    return { memberCount, pendingVotes: 0, next: null };
  }

  const now = new Date();

  const nextRows = await db
    .select({ title: songs.title, startAt: rehearsals.startAt })
    .from(rehearsals)
    .innerJoin(songs, eq(rehearsals.songId, songs.id))
    .where(
      and(
        eq(rehearsals.orgId, orgId),
        eq(rehearsals.status, 'confirmed'),
        inArray(rehearsals.songId, mySongIds),
        gte(rehearsals.startAt, now),
      ),
    )
    .orderBy(rehearsals.startAt)
    .limit(1);
  const next = nextRows[0]
    ? { title: nextRows[0].title, startAt: nextRows[0].startAt }
    : null;

  // 투표중(마감 전)인 내 곡의 합주 중, 내가 아직 표를 안 던진 것.
  const openVotes = await db
    .select({ voteId: rehearsalVotes.id })
    .from(rehearsalVotes)
    .innerJoin(rehearsals, eq(rehearsalVotes.rehearsalId, rehearsals.id))
    .where(
      and(
        eq(rehearsals.orgId, orgId),
        eq(rehearsals.status, 'voting'),
        inArray(rehearsals.songId, mySongIds),
        gte(rehearsalVotes.voteCloseAt, now),
      ),
    );

  let pendingVotes = 0;
  if (openVotes.length) {
    const voteIds = openVotes.map((v) => v.voteId);
    const myBallots = await db
      .selectDistinct({ voteId: rehearsalVoteOptions.voteId })
      .from(rehearsalVoteBallots)
      .innerJoin(
        rehearsalVoteOptions,
        eq(rehearsalVoteBallots.optionId, rehearsalVoteOptions.id),
      )
      .where(
        and(
          eq(rehearsalVoteBallots.userId, userId),
          inArray(rehearsalVoteOptions.voteId, voteIds),
        ),
      );
    const voted = new Set(myBallots.map((b) => b.voteId));
    pendingVotes = voteIds.filter((id) => !voted.has(id)).length;
  }

  return { memberCount, pendingVotes, next };
}
