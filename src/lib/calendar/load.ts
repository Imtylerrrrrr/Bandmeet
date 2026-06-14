// DB → 주간 캘린더 예약(Booking) 로더.
// 룸 마스터(org 전체) + 개인 통합(내 합주) 두 가지. 시간은 정수 hour-slot 으로 변환.

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
import { dateHourToSlot, durationToHours, instantToSlot } from '@/lib/matching/slots';

export interface WeekBookings {
  weekStart: string; // 'YYYY-MM-DD' (그 주 일요일)
  bookings: Booking[];
  nameById: Map<string, string>; // 참여자 userId -> 이름 (충돌 메시지용)
}

/** 그 booking 이 [weekStart, weekStart+7일) 와 겹치는지. */
function inWeek(b: { start: number; end: number }, wStart: number, wEnd: number) {
  return b.start < wEnd && wStart < b.end;
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
 * 룸 마스터 캘린더: org 의 모든 확정 합주 + 회의 중 그 주에 걸치는 것.
 */
export async function loadOrgWeek(
  orgId: string,
  weekStart: string,
): Promise<WeekBookings> {
  const wStart = dateHourToSlot(weekStart, 0);
  const wEnd = wStart + 7 * 24;

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

  // 그 주 합주의 곡 → 참여자.
  const weekReh = rehRows
    .map((r) => {
      const s = instantToSlot(r.startAt);
      return { ...r, start: s, end: s + durationToHours(r.durationMin) };
    })
    .filter((r) => inWeek(r, wStart, wEnd));

  const songIds = [...new Set(weekReh.map((r) => r.songId))];
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
  for (const r of weekReh) {
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
    const s = instantToSlot(m.startAt);
    const e = s + durationToHours(m.durationMin);
    if (!inWeek({ start: s, end: e }, wStart, wEnd)) continue;
    bookings.push({
      id: m.id,
      type: 'meeting',
      start: s,
      end: e,
      title: m.title ?? '회의',
      members: [],
    });
  }

  const nameById = await loadNames(bookings.flatMap((b) => b.members));
  return { weekStart, bookings, nameById };
}

/**
 * 개인 통합 뷰: 내가 참여하는 곡의 확정 합주 + org 회의(전원 가정) 중 그 주에 걸치는 것.
 */
export async function loadPersonalWeek(
  orgId: string,
  userId: string,
  weekStart: string,
): Promise<WeekBookings> {
  const wStart = dateHourToSlot(weekStart, 0);
  const wEnd = wStart + 7 * 24;

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
      const s = instantToSlot(r.startAt);
      const e = s + durationToHours(r.durationMin);
      if (!inWeek({ start: s, end: e }, wStart, wEnd)) continue;
      bookings.push({
        id: r.id,
        type: 'rehearsal',
        start: s,
        end: e,
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
    const s = instantToSlot(m.startAt);
    const e = s + durationToHours(m.durationMin);
    if (!inWeek({ start: s, end: e }, wStart, wEnd)) continue;
    bookings.push({ id: m.id, type: 'meeting', start: s, end: e, title: m.title ?? '회의', members: [] });
  }

  return { weekStart, bookings, nameById: new Map() };
}
