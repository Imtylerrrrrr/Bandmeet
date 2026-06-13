// DB → 매칭 엔진 입력 로더.
// 엔진은 정수 hour-slot 으로 동작(순수). 여기서 KST 기준 실제 날짜/시간 ↔ slot 을 매핑하고
// 가용성(템플릿+예외) 해석, 점유 차감(확정 합주/미팅), 방 점유를 조립한다.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  availabilityException,
  availabilityTemplate,
  meetings,
  performances,
  profiles,
  rehearsals,
  songMembers,
  songs,
  teams,
} from '@/lib/db/schema';
import type { MemberAvailability, RecommendInput, Tier } from './engine';
import {
  BAND_END_HOUR,
  BAND_START_HOUR,
  addDays,
  dateHourToSlot,
  dateStrToDays,
  durationToHours,
  instantToSlot,
  kstDateStr,
  kstWeekday,
} from './slots';

const DEFAULT_HORIZON_DAYS = 21;
const MAX_HORIZON_DAYS = 70;

export interface LoadedMatch {
  input: RecommendInput;
  song: { id: string; title: string; teamId: string; orgId: string };
  members: { userId: string; name: string }[];
  horizon: { startDate: string; days: number; perfDate: string | null };
}

/**
 * 한 곡에 대한 매칭 엔진 입력을 DB 에서 조립.
 * - 가용성: availability_template(주간) + availability_exception(날짜별, null=불가) 해석.
 * - 사람 점유(busy): 그 멤버가 참여하는 다른 확정 합주 + org 미팅(전원).
 * - 방 점유(roomBusy): org 의 모든 확정 합주(방 1개).
 * - existing(이어서용): 각 멤버 본인의 확정 합주 구간.
 * 곡이 없으면 null, 멤버 0이면 빈 입력.
 */
export async function loadRecommendInput(
  songId: string,
  now: Date,
  opts?: { topK?: number; durations?: number[] },
): Promise<LoadedMatch | null> {
  const topK = opts?.topK ?? 8;
  const durations = opts?.durations ?? [1, 2];

  const [song] = await db
    .select({ id: songs.id, title: songs.title, teamId: songs.teamId, orgId: songs.orgId })
    .from(songs)
    .where(eq(songs.id, songId));
  if (!song) return null;

  // 공연일 → 지평 끝.
  const [team] = await db
    .select({ performanceId: teams.performanceId })
    .from(teams)
    .where(eq(teams.id, song.teamId));
  let perfDate: string | null = null;
  if (team) {
    const [perf] = await db
      .select({ performDate: performances.performDate })
      .from(performances)
      .where(eq(performances.id, team.performanceId));
    perfDate = perf?.performDate ?? null;
  }

  // 곡 담당자.
  const memberRows = await db
    .select({ userId: songMembers.userId, name: profiles.name })
    .from(songMembers)
    .innerJoin(profiles, eq(songMembers.userId, profiles.id))
    .where(eq(songMembers.songId, songId));
  const memberIds = memberRows.map((m) => m.userId);

  const startDate = kstDateStr(now);
  let days = DEFAULT_HORIZON_DAYS;
  if (perfDate && perfDate >= startDate) {
    const diff = dateStrToDays(perfDate) - dateStrToDays(startDate);
    days = Math.min(MAX_HORIZON_DAYS, Math.max(1, diff + 1));
  }

  const empty: LoadedMatch = {
    input: { members: [], roomBusy: new Set(), roomIntervals: [], candidateSlots: [], durations, topK },
    song,
    members: memberRows,
    horizon: { startDate, days, perfDate },
  };
  if (memberIds.length === 0) return empty;

  // 가용성 템플릿/예외.
  const tmplRows = await db
    .select()
    .from(availabilityTemplate)
    .where(
      and(eq(availabilityTemplate.orgId, song.orgId), inArray(availabilityTemplate.userId, memberIds)),
    );
  const excRows = await db
    .select()
    .from(availabilityException)
    .where(
      and(eq(availabilityException.orgId, song.orgId), inArray(availabilityException.userId, memberIds)),
    );
  // userId -> weekday -> hour -> tier
  const tmpl = new Map<string, Map<number, Map<number, Tier>>>();
  for (const r of tmplRows) {
    const byWd = tmpl.get(r.userId) ?? new Map();
    const byHr = byWd.get(r.weekday) ?? new Map();
    byHr.set(r.hour, r.tier as Tier);
    byWd.set(r.weekday, byHr);
    tmpl.set(r.userId, byWd);
  }
  // userId -> 'date' -> hour -> tier|null (키 존재 = 예외)
  const exc = new Map<string, Map<string, Map<number, Tier | null>>>();
  for (const r of excRows) {
    const byDate = exc.get(r.userId) ?? new Map();
    const byHr = byDate.get(r.date) ?? new Map();
    byHr.set(r.hour, (r.tier as Tier | null) ?? null);
    byDate.set(r.date, byHr);
    exc.set(r.userId, byDate);
  }

  // org 확정 합주(방 점유 + 사람 점유 산출) + 미팅.
  const confirmed = await db
    .select({ id: rehearsals.id, songId: rehearsals.songId, startAt: rehearsals.startAt, durationMin: rehearsals.durationMin })
    .from(rehearsals)
    .where(and(eq(rehearsals.orgId, song.orgId), eq(rehearsals.status, 'confirmed')));
  const mtgRows = await db
    .select({ startAt: meetings.startAt, durationMin: meetings.durationMin })
    .from(meetings)
    .where(eq(meetings.orgId, song.orgId));

  // 확정 합주별 참여자(song_members) — 우리 멤버의 busy/existing 판정용.
  const confirmedSongIds = [...new Set(confirmed.map((r) => r.songId))];
  const rehMembers = new Map<string, Set<string>>(); // songId -> userIds
  if (confirmedSongIds.length) {
    const rows = await db
      .select({ songId: songMembers.songId, userId: songMembers.userId })
      .from(songMembers)
      .where(inArray(songMembers.songId, confirmedSongIds));
    for (const r of rows) {
      const s = rehMembers.get(r.songId) ?? new Set();
      s.add(r.userId);
      rehMembers.set(r.songId, s);
    }
  }

  // 방 점유 slot/구간 = 모든 확정 합주.
  const roomBusy = new Set<number>();
  const roomIntervals: Array<{ start: number; end: number }> = [];
  for (const r of confirmed) {
    const s = instantToSlot(r.startAt);
    const e = s + durationToHours(r.durationMin);
    roomIntervals.push({ start: s, end: e });
    for (let h = s; h < e; h++) roomBusy.add(h);
  }

  // 멤버별 busy/existing.
  const busyByUser = new Map<string, Set<number>>();
  const existingByUser = new Map<string, Array<{ start: number; end: number }>>();
  const ensure = (u: string) => {
    if (!busyByUser.has(u)) busyByUser.set(u, new Set());
    if (!existingByUser.has(u)) existingByUser.set(u, []);
  };
  for (const id of memberIds) ensure(id);
  for (const r of confirmed) {
    const parts = rehMembers.get(r.songId);
    if (!parts) continue;
    const s = instantToSlot(r.startAt);
    const e = s + durationToHours(r.durationMin);
    for (const u of memberIds) {
      if (!parts.has(u)) continue;
      const busy = busyByUser.get(u)!;
      for (let h = s; h < e; h++) busy.add(h);
      existingByUser.get(u)!.push({ start: s, end: e });
    }
  }
  // 미팅: 멤버 명단 없음 → 전원 점유(보수적, org 회의 가정).
  for (const mtg of mtgRows) {
    const s = instantToSlot(mtg.startAt);
    const e = s + durationToHours(mtg.durationMin);
    for (const u of memberIds) {
      const busy = busyByUser.get(u)!;
      for (let h = s; h < e; h++) busy.add(h);
    }
  }

  // 멤버별 가용 slot(Map<slot,tier>) — 지평 내 band 시간 전개.
  const members: MemberAvailability[] = memberIds.map((userId) => {
    const slots = new Map<number, Tier>();
    const uTmpl = tmpl.get(userId);
    const uExc = exc.get(userId);
    for (let i = 0; i < days; i++) {
      const dateStr = addDays(startDate, i);
      const wd = kstWeekday(dateStr);
      const excDay = uExc?.get(dateStr);
      const tmplDay = uTmpl?.get(wd);
      for (let h = BAND_START_HOUR; h < BAND_END_HOUR; h++) {
        let tier: Tier | null | undefined;
        if (excDay && excDay.has(h)) tier = excDay.get(h)!; // 예외(null=불가)
        else tier = tmplDay?.get(h); // 템플릿
        if (tier === 'green' || tier === 'yellow') {
          slots.set(dateHourToSlot(dateStr, h), tier);
        }
      }
    }
    return {
      userId,
      slots,
      busy: busyByUser.get(userId) ?? new Set(),
      existing: existingByUser.get(userId) ?? [],
    };
  });

  // 후보 시작 slot = 지평 내 band 시간 전부, 단 과거(now 이전)는 제외.
  const nowSlot = instantToSlot(now);
  const candidateSlots: number[] = [];
  for (let i = 0; i < days; i++) {
    const dateStr = addDays(startDate, i);
    for (let h = BAND_START_HOUR; h < BAND_END_HOUR; h++) {
      const slot = dateHourToSlot(dateStr, h);
      if (slot >= nowSlot) candidateSlots.push(slot);
    }
  }

  return {
    input: { members, roomBusy, roomIntervals, candidateSlots, durations, topK },
    song,
    members: memberRows,
    horizon: { startDate, days, perfDate },
  };
}
