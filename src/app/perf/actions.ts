'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { performances } from '@/lib/db/schema';
import { requireOrgAdmin } from '@/lib/org';

export async function createPerformance(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const performDate = String(formData.get('performDate') ?? '').trim();
  const deadline = String(formData.get('deadline') ?? '').trim();
  if (!name) throw new Error('공연 이름을 입력하세요.');
  await requireOrgAdmin(orgId);

  await db.insert(performances).values({
    orgId,
    name,
    performDate: performDate || null,
    deadline: deadline ? new Date(deadline) : null,
  });
  revalidatePath('/perf');
}

export async function deletePerformance(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  const id = String(formData.get('id') ?? '');
  await requireOrgAdmin(orgId);
  await db
    .delete(performances)
    .where(and(eq(performances.id, id), eq(performances.orgId, orgId)));
  revalidatePath('/perf');
}
