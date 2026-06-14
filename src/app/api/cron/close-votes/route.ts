// Vercel Cron 엔드포인트 — 마감된 투표 자동 확정 (매시간, 빌드매뉴얼 §6).
// vercel.json 의 crons 에서 매시 호출. CRON_SECRET 이 설정돼 있으면 Bearer 로 보호.
// Vercel Cron 은 CRON_SECRET 설정 시 자동으로 'Authorization: Bearer <CRON_SECRET>' 를 보낸다.

import { NextResponse } from 'next/server';

import { closeDueVotes } from '@/lib/matching/close';
import { bearerAuthorized } from '@/lib/api-auth';

// postgres-js 드라이버 사용 → Node 런타임 필수(edge 금지). 정적 최적화 차단.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  // CRON_SECRET 필수(fail-closed). Vercel Cron 은 설정 시 Bearer 를 자동 전송한다.
  if (!bearerAuthorized(request, process.env.CRON_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const summary = await closeDueVotes(new Date());
  return NextResponse.json({ ok: true, ...summary });
}
