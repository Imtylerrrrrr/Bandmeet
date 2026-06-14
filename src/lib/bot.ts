// 사설 봇(메신저봇R) 서버측 헬퍼 (매뉴얼 §8·10).
// 안전 규칙: 읽기 + 알림만. 봇은 상태를 바꾸지 못한다(투표/확정 금지).
// 공유 시크릿(BOT_SECRET) 인증 + 단톡방↔org 바인딩으로 테넌트 라우팅.

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatBindings, meetings, rehearsals, songs } from '@/lib/db/schema';
import { fmtWhen } from '@/lib/messages';
import { bearerAuthorized } from '@/lib/api-auth';

/** Authorization: Bearer <BOT_SECRET> 검증. 미설정이면 봇 비활성(거부). */
export function botAuthorized(request: Request): boolean {
  return bearerAuthorized(request, process.env.BOT_SECRET);
}

/** 단톡방 이름 → org id. 바인딩 없으면 null(봇은 침묵). */
export async function resolveOrgByRoom(roomName: string): Promise<string | null> {
  if (!roomName) return null;
  const [b] = await db
    .select({ orgId: chatBindings.orgId })
    .from(chatBindings)
    .where(eq(chatBindings.roomName, roomName));
  return b?.orgId ?? null;
}

/** `/합주봇` 조회 응답 텍스트 — 앞으로 days 일간 확정 합주 + 회의. */
export async function scheduleText(orgId: string, now: Date, days = 7): Promise<string> {
  const horizonEnd = new Date(now.getTime() + days * 86400000);

  const rehs = await db
    .select({ title: songs.title, startAt: rehearsals.startAt, durationMin: rehearsals.durationMin })
    .from(rehearsals)
    .innerJoin(songs, eq(rehearsals.songId, songs.id))
    .where(and(eq(rehearsals.orgId, orgId), eq(rehearsals.status, 'confirmed')))
    .orderBy(asc(rehearsals.startAt));
  const mtgs = await db
    .select({ title: meetings.title, startAt: meetings.startAt, durationMin: meetings.durationMin })
    .from(meetings)
    .where(eq(meetings.orgId, orgId));

  const items = [
    ...rehs.map((r) => ({ icon: '🎸', title: r.title, startAt: r.startAt, durationMin: r.durationMin })),
    ...mtgs.map((m) => ({ icon: '📋', title: m.title ?? '회의', startAt: m.startAt, durationMin: m.durationMin })),
  ]
    .filter((it) => it.startAt >= now && it.startAt < horizonEnd)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (items.length === 0) return '예정된 합주·회의가 없어요.';
  return items.map((it) => `${it.icon} ${fmtWhen(it.startAt, it.durationMin)} ${it.title}`).join('\n');
}
