// 봇 발송 확인(멱등) — 게시 완료한 아웃박스 메시지를 sent 로 원자적 표시(매뉴얼 §8-3).
// 이미 sent 인 것은 무시(재호출 안전). 봇 크래시 시 미ack 메시지는 다음 폴링에 재게시(at-least-once).

import { NextResponse } from 'next/server';
import { and, inArray, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { outbox } from '@/lib/db/schema';
import { botAuthorized } from '@/lib/bot';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (!botAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: true, acked: 0 });

  await db
    .update(outbox)
    .set({ sentAt: new Date() })
    .where(and(inArray(outbox.id, ids), isNull(outbox.sentAt)));

  return NextResponse.json({ ok: true, acked: ids.length });
}
