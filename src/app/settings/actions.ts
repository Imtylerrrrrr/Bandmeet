'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatBindings, orgs } from '@/lib/db/schema';
import { requireOrgAdmin } from '@/lib/org';

/** 동아리 이름 변경(운영진). 헤더·전 화면에 반영. */
export async function renameOrg(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 40);
  await requireOrgAdmin(orgId);
  if (!name) throw new Error('동아리 이름을 입력하세요.');
  await db.update(orgs).set({ name }).where(eq(orgs.id, orgId));
  revalidatePath('/', 'layout');
}

/** 단톡방 ↔ org 바인딩 설정/변경(운영진). org 당 1개. */
export async function setBinding(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const roomName = String(formData.get('roomName') ?? '').trim();
  await requireOrgAdmin(orgId);
  if (!roomName) throw new Error('단톡방 이름을 입력하세요.');

  // 다른 org 가 이미 같은 방 이름을 쓰면 거부(전역 unique).
  const taken = await db
    .select({ id: chatBindings.id })
    .from(chatBindings)
    .where(and(eq(chatBindings.roomName, roomName), ne(chatBindings.orgId, orgId)));
  if (taken.length > 0) throw new Error('이미 다른 동아리에 연결된 단톡방 이름입니다.');

  await db.transaction(async (tx) => {
    await tx.delete(chatBindings).where(eq(chatBindings.orgId, orgId));
    await tx.insert(chatBindings).values({ orgId, roomName });
  });
  revalidatePath('/settings');
}

/** 바인딩 해제(운영진). */
export async function removeBinding(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  await requireOrgAdmin(orgId);
  await db.delete(chatBindings).where(eq(chatBindings.orgId, orgId));
  revalidatePath('/settings');
}
