// 마감된 투표 자동 확정 (빌드매뉴얼 §6, 7단계).
//
// voteCloseAt 이 지난 투표 중 합주가 아직 'voting' 인 것을 모아:
//  1) 랭크 투표 집계(tally) → 사전식 순위
//  2) 그 순위대로 "방·사람 점유와 안 겹치는" 첫 옵션(= 최상위 빈 슬롯) 선택
//  3) 합주를 그 옵션의 원래 slot_start/duration 으로 'confirmed' (= 방 점유 기록)
//  4) 빈 옵션이 하나도 없으면 'conflict' 플래그(사람이 재투표)
//
// 동시성: 전체를 한 트랜잭션으로 감싸고 advisory lock 으로 직렬화한다.
// Vercel Cron 은 드물게 중복 실행될 수 있는데(at-least-once), 락이 없으면 두 실행이
// 같은 빈 슬롯을 동시에 확정해 방 1개를 더블부킹할 수 있다. 락으로 한 번에 하나만 돌고,
// 뒤 실행의 due 조회는 앞 실행이 confirmed 로 바꾼 합주를 자연히 제외한다.
// 트랜잭션이라 한 실행 안의 직전 확정이 다음 투표의 점유 재조회에 즉시 보인다(자기 가시성).

import { and, eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  meetings,
  rehearsalVoteBallots,
  rehearsalVoteOptions,
  rehearsalVotes,
  rehearsals,
  songMembers,
  songs,
} from '@/lib/db/schema';
import { enqueueOutbox, notifyUsers } from '@/lib/outbox';
import {
  notifyConfirmed,
  notifyConflict,
  outboxConfirmed,
  outboxConflict,
} from '@/lib/messages';
import { durationToHours, instantToSlot } from './slots';
import { type Interval, pickWinner, tallyVotes } from './tally';

// 한 번에 하나의 close 실행만 돌도록 하는 advisory lock 키(임의 고정 정수).
const CLOSE_LOCK_KEY = 4216749;

// 트랜잭션 콜백이 받는 tx 의 정확한 타입(추론).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CloseSummary {
  processed: number; // 집계한 마감 투표 수
  confirmed: number; // 자동 확정된 합주 수
  conflicts: number; // 빈 슬롯 없어 충돌 플래그된 수
  details: Array<{
    rehearsalId: string;
    outcome: 'confirmed' | 'conflict';
    optionId?: string;
  }>;
}

/**
 * org 의 현재 점유 구간(빈 슬롯 판정용) = 모든 확정 합주 ∪ 모든 미팅.
 *  - 확정 합주: 방 점유(방 1개). 두 합주가 같은 방을 못 씀.
 *  - 미팅: 방은 안 쓰지만 사람 충돌 — 멤버 명단이 없어 보수적으로 전원 점유로 가정
 *    (load.ts 추천 단계와 동일 규칙. 그래야 추천한 슬롯만 확정된다).
 */
async function loadOccupied(tx: Tx, orgId: string): Promise<Interval[]> {
  const confirmed = await tx
    .select({ startAt: rehearsals.startAt, durationMin: rehearsals.durationMin })
    .from(rehearsals)
    .where(and(eq(rehearsals.orgId, orgId), eq(rehearsals.status, 'confirmed')));
  const mtgRows = await tx
    .select({ startAt: meetings.startAt, durationMin: meetings.durationMin })
    .from(meetings)
    .where(eq(meetings.orgId, orgId));

  const occupied: Interval[] = [];
  for (const r of [...confirmed, ...mtgRows]) {
    const s = instantToSlot(r.startAt);
    occupied.push({ start: s, end: s + durationToHours(r.durationMin) });
  }
  return occupied;
}

/** 충돌(빈 슬롯 없음/옵션 없음) 시 아웃박스 + 인앱 알림 (확정 분기와 대칭). */
async function notifyConflictOf(
  tx: Tx,
  vote: { orgId: string; songId: string; songTitle: string; rehearsalId: string },
  memberIdsOf: (songId: string) => Promise<string[]>,
): Promise<void> {
  const members = await memberIdsOf(vote.songId);
  await enqueueOutbox(
    tx,
    vote.orgId,
    outboxConflict(vote.songTitle),
    `conflict:${vote.rehearsalId}`,
  );
  await notifyUsers(tx, vote.orgId, members, notifyConflict(vote.songTitle), `/match/${vote.songId}`);
}

/** voteCloseAt ≤ now 이고 합주가 'voting' 인 투표를 모두 마감 처리. */
export async function closeDueVotes(now: Date): Promise<CloseSummary> {
  return db.transaction(async (tx) => {
    // 동시 실행 직렬화: 뒤 실행은 여기서 대기 → 앞 실행 커밋 후 진행.
    await tx.execute(sql`select pg_advisory_xact_lock(${CLOSE_LOCK_KEY})`);

    const due = await tx
      .select({
        voteId: rehearsalVotes.id,
        rehearsalId: rehearsals.id,
        orgId: rehearsals.orgId,
        songId: rehearsals.songId,
        songTitle: songs.title,
      })
      .from(rehearsalVotes)
      .innerJoin(rehearsals, eq(rehearsalVotes.rehearsalId, rehearsals.id))
      .innerJoin(songs, eq(rehearsals.songId, songs.id))
      .where(and(lte(rehearsalVotes.voteCloseAt, now), eq(rehearsals.status, 'voting')));

    // 곡 담당자(알림 수신자) 조회.
    const memberIdsOf = async (songId: string) =>
      (
        await tx
          .select({ userId: songMembers.userId })
          .from(songMembers)
          .where(eq(songMembers.songId, songId))
      ).map((r) => r.userId);

    const summary: CloseSummary = {
      processed: 0,
      confirmed: 0,
      conflicts: 0,
      details: [],
    };

    const seenRehearsals = new Set<string>(); // 한 합주에 투표가 여럿이면 한 번만 처리.

    for (const vote of due) {
      if (seenRehearsals.has(vote.rehearsalId)) continue;
      seenRehearsals.add(vote.rehearsalId);
      summary.processed++;

      const options = await tx
        .select()
        .from(rehearsalVoteOptions)
        .where(eq(rehearsalVoteOptions.voteId, vote.voteId));

      // 옵션이 없는 비정상 투표 → 확정 불가, 충돌로.
      if (options.length === 0) {
        await tx
          .update(rehearsals)
          .set({ status: 'conflict' })
          .where(eq(rehearsals.id, vote.rehearsalId));
        await notifyConflictOf(tx, vote, memberIdsOf);
        summary.conflicts++;
        summary.details.push({ rehearsalId: vote.rehearsalId, outcome: 'conflict' });
        continue;
      }

      const optionIds = options.map((o) => o.id);
      const ballots = await tx
        .select({
          optionId: rehearsalVoteBallots.optionId,
          rank: rehearsalVoteBallots.rank,
        })
        .from(rehearsalVoteBallots)
        .where(inArray(rehearsalVoteBallots.optionId, optionIds));

      const tallied = tallyVotes(
        options.map((o) => ({
          id: o.id,
          start: instantToSlot(o.slotStart),
          duration: durationToHours(o.durationMin),
        })),
        ballots,
      );

      // 직전 확정까지 반영된 최신 점유로 빈 슬롯 판정(트랜잭션 자기 가시성).
      const occupied = await loadOccupied(tx, vote.orgId);
      const winner = pickWinner(tallied, occupied);

      if (!winner) {
        await tx
          .update(rehearsals)
          .set({ status: 'conflict' })
          .where(eq(rehearsals.id, vote.rehearsalId));
        await notifyConflictOf(tx, vote, memberIdsOf);
        summary.conflicts++;
        summary.details.push({ rehearsalId: vote.rehearsalId, outcome: 'conflict' });
        continue;
      }

      // 원래 옵션의 정확한 timestamp/duration 으로 확정(slot 반올림값 말고).
      const winOpt = options.find((o) => o.id === winner.id)!;
      await tx
        .update(rehearsals)
        .set({
          startAt: winOpt.slotStart,
          durationMin: winOpt.durationMin,
          status: 'confirmed',
        })
        .where(eq(rehearsals.id, vote.rehearsalId));

      // 단톡 아웃박스 + 곡 담당자 인앱 알림 (확정과 원자적).
      const members = await memberIdsOf(vote.songId);
      await enqueueOutbox(
        tx,
        vote.orgId,
        outboxConfirmed(vote.songTitle, winOpt.slotStart, winOpt.durationMin),
        `confirmed:${vote.rehearsalId}`,
      );
      await notifyUsers(
        tx,
        vote.orgId,
        members,
        notifyConfirmed(vote.songTitle, winOpt.slotStart, winOpt.durationMin),
        `/match/${vote.songId}`,
      );

      summary.confirmed++;
      summary.details.push({
        rehearsalId: vote.rehearsalId,
        outcome: 'confirmed',
        optionId: winner.id,
      });
    }

    return summary;
  });
}
