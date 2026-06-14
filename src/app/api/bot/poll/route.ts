// 봇 아웃바운드 폴링 — 그 단톡방(org)의 미발송 아웃박스 메시지 반환(매뉴얼 §8 아웃바운드).
// 봇이 이 메시지들을 replyRoom 으로 게시한 뒤 /api/bot/ack 로 발송 표시.

import { NextResponse } from 'next/server';
import { and, asc, isNull, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { outbox } from '@/lib/db/schema';
import { botAuthorized, resolveOrgByRoom } from '@/lib/bot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!botAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });

  const room = new URL(request.url).searchParams.get('room') ?? '';
  const orgId = await resolveOrgByRoom(room);
  if (!orgId) return NextResponse.json({ messages: [] }); // 미바인딩 → 침묵

  const rows = await db
    .select({ id: outbox.id, body: outbox.body })
    .from(outbox)
    .where(and(eq(outbox.orgId, orgId), isNull(outbox.sentAt)))
    .orderBy(asc(outbox.createdAt))
    .limit(20);

  return NextResponse.json({ messages: rows });
}
