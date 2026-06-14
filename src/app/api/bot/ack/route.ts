// 봇 발송 확인(멱등) — 게시 완료한 아웃박스 메시지를 sent 로 원자적 표시(매뉴얼 §8-3).
// 이미 sent 인 것은 무시(재호출 안전). 봇 크래시 시 미ack 메시지는 다음 폴링에 재게시(at-least-once).

import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { outbox } from '@/lib/db/schema';
import { botAuthorized, resolveOrgByRoom } from '@/lib/bot';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (!botAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null);
  const room = typeof body?.room === 'string' ? body.room : '';
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === 'string')
    : [];

  // 테넌트 격리: 이 단톡방(org)의 메시지만 ack — 공유 시크릿으로 타 org outbox 조작 차단.
  const orgId = await resolveOrgByRoom(room);
  if (!orgId || ids.length === 0) return NextResponse.json({ ok: true, acked: 0 });

  await db
    .update(outbox)
    .set({ sentAt: new Date() })
    .where(and(eq(outbox.orgId, orgId), inArray(outbox.id, ids), isNull(outbox.sentAt)));

  return NextResponse.json({ ok: true, acked: ids.length });
}
