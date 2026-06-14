// 아웃박스(단톡 알림 큐) + 인앱 알림 적재 헬퍼.
// 트랜잭션(tx) 안에서 호출해 상태 변경과 원자적으로 묶는다(예: close-votes 확정).

import { db } from '@/lib/db';
import { notifications, outbox } from '@/lib/db/schema';

// 트랜잭션 콜백이 받는 tx 의 정확한 타입(추론).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 아웃박스에 단톡 게시 메시지를 적재(멱등).
 * dedupeKey 가 있으면 같은 키 중복은 무시(ON CONFLICT DO NOTHING) — 매뉴얼 §8-3.
 */
export async function enqueueOutbox(
  tx: Tx,
  orgId: string,
  body: string,
  dedupeKey?: string,
): Promise<void> {
  await tx
    .insert(outbox)
    .values({ orgId, body, dedupeKey: dedupeKey ?? null })
    .onConflictDoNothing();
}

/** 인앱 알림을 여러 수신자에게 적재. */
export async function notifyUsers(
  tx: Tx,
  orgId: string,
  userIds: string[],
  body: string,
  link?: string,
): Promise<void> {
  if (userIds.length === 0) return;
  await tx
    .insert(notifications)
    .values(userIds.map((userId) => ({ orgId, userId, body, link: link ?? null })));
}
