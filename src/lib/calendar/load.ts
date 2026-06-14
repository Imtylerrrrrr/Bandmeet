// DB → 캘린더 예약(Booking) 로더.
// 룸 마스터(org 전체) + 개인 통합(내 합주) 두 가지. 시간은 정수 hour-slot 으로 변환.
// 임의 날짜 범위 [startDate, endDate) 를 받는다(일/주/월 뷰 공용). 주 로더는 thin wrapper.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  meetings,
  profiles,
  rehearsals,
  songMembers,
  songs,
} from '@/lib/db/schema';
import type { Booking } from './conflicts';
import { addDays, dateHourToSlot, toInterval } from '@/lib/matching/slots';

export interface RangeBookings {
  bookings: Booking[];
  nameById: Map<string, string>; // 참여자 userId -> 이름 (충돌 메시지용)
}

export interface WeekBookings extends RangeBookings {
  weekStart: string; // 'YYYY-MM-DD' (그 주 일요일)
}

/** 그 booking 이 hour-slot 범위 [start, end) 와 겹치는지. */
function inRange(b: { start: number; end: number }, start: number, end: number) {
  return b.start < end && start < b.end;
}

/** 참여자 이름 맵 조회. */
async function loadNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: profiles.id, name: profiles.name })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * 룸 마스터 캘린더: org 의 모든 확정 합주 + 회의 중 [startDate, endDate) 에 걸치는 것.
 * startDate 포함, endDate 제외(둘 다 'YYYY-MM-DD' KST 자정 기준).
 */
export async function loadOrgRange(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<RangeBookings> {
  const rStart = dateHourToSlot(startDate, 0);
  const rEnd = dateHourToSlot(endDate, 0);

  const rehRows = await db
    .select({
      id: rehearsals.id,
      songId: rehearsals.songId,
      title: songs.title,
      startAt: rehearsals.startAt,
      durationMin: rehearsals.durationMin,
      isExtra: rehearsals.isExtra,
    })
    .from(rehearsals)
    .innerJoin(songs, eq(rehearsals.songId, songs.id))
    .where(and(eq(rehearsals.orgId, orgId), eq(rehearsals.status, 'confirmed')));

  const mtgRows = await db
    .select({ id: meetings.id, title: meetings.title, startAt: meetings.startAt, durationMin: meetings.durationMin })
    .from(meetings)
    .where(eq(meetings.orgId, orgId));

  // 범위 안 합주의 곡 → 참여자.
  const rangeReh = rehRows
    .map((r) => ({ ...r, ...toInterval(r.startAt, r.durationMin) }))
    .filter((r) => inRange(r, rStart, rEnd));

  const songIds = [...new Set(rangeReh.map((r) => r.songId))];
  const membersBySong = new Map<string, string[]>();
  if (songIds.length) {
    const sm = await db
      .select({ songId: songMembers.songId, userId: songMembers.userId })
      .from(songMembers)
      .where(inArray(songMembers.songId, songIds));
    for (const row of sm) {
      const arr = membersBySong.get(row.songId) ?? [];
      arr.push(row.userId);
      membersBySong.set(row.songId, arr);
    }
  }

  const bookings: Booking[] = [];
  for (const r of rangeReh) {
    bookings.push({
      id: r.id,
      type: 'rehearsal',
      start: r.start,
      end: r.end,
      title: r.title + (r.isExtra ? ' (추가)' : ''),
      members: membersBySong.get(r.songId) ?? [],
    });
  }
  for (const m of mtgRows) {
    const iv = toInterval(m.startAt, m.durationMin);
    if (!inRange(iv, rStart, rEnd)) continue;
    bookings.push({ id: m.id, type: 'meeting', ...iv, title: m.title ?? '회의', members: [] });
  }

  const nameById = await loadNames(bookings.flatMap((b) => b.members));
  return { bookings, nameById };
}

/**
 * 개인 통합 뷰: 내가 참여하는 곡의 확정 합주 + org 회의(전원 가정) 중 [startDate, endDate) 에 걸치는 것.
 */
export async function loadPersonalRange(
  orgId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<RangeBookings> {
  const rStart = dateHourToSlot(startDate, 0);
  const rEnd = dateHourToSlot(endDate, 0);

  // 내가 속한 곡들.
  const mySongRows = await db
    .select({ songId: songMembers.songId })
    .from(songMembers)
    .where(eq(songMembers.userId, userId));
  const mySongIds = new Set(mySongRows.map((r) => r.songId));

  const bookings: Booking[] = [];

  if (mySongIds.size) {
    const rehRows = await db
      .select({
        id: rehearsals.id,
        songId: rehearsals.songId,
        title: songs.title,
        startAt: rehearsals.startAt,
        durationMin: rehearsals.durationMin,
        isExtra: rehearsals.isExtra,
      })
      .from(rehearsals)
      .innerJoin(songs, eq(rehearsals.songId, songs.id))
      .where(
        and(
          eq(rehearsals.orgId, orgId),
          eq(rehearsals.status, 'confirmed'),
          inArray(rehearsals.songId, [...mySongIds]),
        ),
      );
    for (const r of rehRows) {
      const iv = toInterval(r.startAt, r.durationMin);
      if (!inRange(iv, rStart, rEnd)) continue;
      bookings.push({
        id: r.id,
        type: 'rehearsal',
        ...iv,
        title: r.title + (r.isExtra ? ' (추가)' : ''),
        members: [userId],
      });
    }
  }

  const mtgRows = await db
    .select({ id: meetings.id, title: meetings.title, startAt: meetings.startAt, durationMin: meetings.durationMin })
    .from(meetings)
    .where(eq(meetings.orgId, orgId));
  for (const m of mtgRows) {
    const iv = toInterval(m.startAt, m.durationMin);
    if (!inRange(iv, rStart, rEnd)) continue;
    bookings.push({ id: m.id, type: 'meeting', ...iv, title: m.title ?? '회의', members: [] });
  }

  return { bookings, nameById: new Map() };
}

/** 개인 통합: 그 주(일요일 시작) 1주간. loadPersonalRange 의 wrapper. */
export async function loadPersonalWeek(
  orgId: string,
  userId: string,
  weekStart: string,
): Promise<WeekBookings> {
  return {
    weekStart,
    ...(await loadPersonalRange(orgId, userId, weekStart, addDays(weekStart, 7))),
  };
}
