'use server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  availabilityException,
  availabilityTemplate,
} from '@/lib/db/schema';
import { requireMembership } from '@/lib/org';
import type { Cell, ExceptionCell } from './types';

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

/**
 * 특정 날짜의 예외(덮어쓰기) 저장. 그 날짜의 기존 예외를 통째로 교체.
 * cells 에 없는 시간 = 예외 없음(템플릿 따름). tier=null = 그 시간 '불가'.
 */
export async function saveException(
  orgId: string,
  date: string,
  cells: Omit<ExceptionCell, 'date'>[],
) {
  const { userId } = await requireMembership(orgId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜 형식 오류');

  const map = new Map<number, 'green' | 'yellow' | null>();
  for (const c of cells) {
    if (
      Number.isInteger(c.hour) &&
      c.hour >= 0 &&
      c.hour <= 23 &&
      (c.tier === 'green' || c.tier === 'yellow' || c.tier === null)
    ) {
      map.set(c.hour, c.tier);
    }
  }
  const rows = [...map.entries()].map(([hour, tier]) => ({
    userId,
    orgId,
    date,
    hour,
    tier,
  }));

  await db.transaction(async (tx) => {
    await tx
      .delete(availabilityException)
      .where(
        and(
          eq(availabilityException.userId, userId),
          eq(availabilityException.orgId, orgId),
          eq(availabilityException.date, date),
        ),
      );
    if (rows.length) await tx.insert(availabilityException).values(rows);
  });

  return { saved: rows.length };
}
