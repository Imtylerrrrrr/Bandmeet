'use server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { availabilityTemplate } from '@/lib/db/schema';
import { requireMembership } from '@/lib/org';
import type { Cell } from './types';

/**
 * 주간 가용성 템플릿 저장. 해당 user+org 의 기존 템플릿을 통째로 교체(트랜잭션).
 * 앱 쿼리는 user_id+org_id 명시 스코프 — RLS 백스톱.
 */
export async function saveTemplate(orgId: string, cells: Cell[]) {
  const { userId } = await requireMembership(orgId);

  // 유효성 + (weekday,hour) 중복 제거(마지막 값 우선).
  const map = new Map<string, Cell>();
  for (const c of cells) {
    if (
      Number.isInteger(c.weekday) &&
      c.weekday >= 0 &&
      c.weekday <= 6 &&
      Number.isInteger(c.hour) &&
      c.hour >= 0 &&
      c.hour <= 23 &&
      (c.tier === 'green' || c.tier === 'yellow')
    ) {
      map.set(`${c.weekday}-${c.hour}`, c);
    }
  }
  const rows = [...map.values()].map((c) => ({
    userId,
    orgId,
    weekday: c.weekday,
    hour: c.hour,
    tier: c.tier,
  }));

  await db.transaction(async (tx) => {
    await tx
      .delete(availabilityTemplate)
      .where(
        and(
          eq(availabilityTemplate.userId, userId),
          eq(availabilityTemplate.orgId, orgId),
        ),
      );
    if (rows.length) await tx.insert(availabilityTemplate).values(rows);
  });

  return { saved: rows.length };
}
