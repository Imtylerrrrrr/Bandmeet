'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { requireMembership } from '@/lib/org';

/** 내 안 읽은 알림 모두 읽음 처리. */
export async function markAllRead(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const { userId } = await requireMembership(orgId);
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.orgId, orgId),
        isNull(notifications.readAt),
      ),
    );
  revalidatePath('/notifications');
}
