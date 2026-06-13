'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { memberships } from '@/lib/db/schema';
import { requireMembership, requireOrgAdmin } from '@/lib/org';

async function adminCount(orgId: string) {
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, 'admin')));
  return rows.length;
}

/** 역할 변경(운영진). 마지막 운영진은 강등 불가. */
export async function setMemberRole(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  if (role !== 'admin' && role !== 'member') throw new Error('잘못된 역할입니다.');
  await requireOrgAdmin(orgId);

  if (role === 'member' && (await adminCount(orgId)) <= 1) {
    throw new Error('마지막 운영진은 강등할 수 없습니다.');
  }
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath('/members');
}

/** 부원 제거(운영진). 본인 제거 불가. */
export async function removeMember(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const admin = await requireOrgAdmin(orgId);
  if (admin.userId === userId) {
    throw new Error('본인은 제거할 수 없습니다. "동아리 나가기"를 사용하세요.');
  }
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  revalidatePath('/members');
}

/** 동아리 나가기(본인). 마지막 운영진이면 불가. */
export async function leaveOrg(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const m = await requireMembership(orgId);
  if (m.role === 'admin' && (await adminCount(orgId)) <= 1) {
    throw new Error('마지막 운영진은 나갈 수 없습니다. 다른 운영진을 먼저 지정하세요.');
  }
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, m.userId)));
  redirect('/');
}
