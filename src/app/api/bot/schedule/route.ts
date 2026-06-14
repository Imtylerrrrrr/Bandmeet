// 봇 인바운드 조회(읽기 전용) — `/합주봇` 명령 시 단톡방 org 의 다가오는 일정 텍스트 반환.
// 상태 변경 없음(매뉴얼 §8-1 안전 규칙). 미바인딩 방엔 안내만.

import { NextResponse } from 'next/server';

import { botAuthorized, resolveOrgByRoom, scheduleText } from '@/lib/bot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!botAuthorized(request)) return new NextResponse('Unauthorized', { status: 401 });

  const params = new URL(request.url).searchParams;
  const room = params.get('room') ?? '';
  const days = Math.min(31, Math.max(1, Number(params.get('days')) || 7));

  const orgId = await resolveOrgByRoom(room);
  if (!orgId) {
    return NextResponse.json({ text: '이 방은 아직 동아리에 연결되지 않았어요.' });
  }

  const text = await scheduleText(orgId, new Date(), days);
  return NextResponse.json({ text });
}
