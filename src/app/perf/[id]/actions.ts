'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { performances, teams } from '@/lib/db/schema';
import { requireOrgAdmin } from '@/lib/org';

async function perfOrg(performanceId: string) {
  const [p] = await db
    .select({ orgId: performances.orgId })
    .from(performances)
    .where(eq(performances.id, performanceId));
  if (!p) throw new Error('공연을 찾을 수 없습니다.');
  return p.orgId;
}

export async function createTeam(formData: FormData) {
  const performanceId = String(formData.get('performanceId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('팀 이름을 입력하세요.');
  const orgId = await perfOrg(performanceId);
  await requireOrgAdmin(orgId);

  await db.insert(teams).values({ orgId, performanceId, name });
  revalidatePath(`/perf/${performanceId}`);
}

export async function deleteTeam(formData: FormData) {
  const performanceId = String(formData.get('performanceId') ?? '');
  const id = String(formData.get('id') ?? '');
  const orgId = await perfOrg(performanceId);
  await requireOrgAdmin(orgId);

  await db.delete(teams).where(and(eq(teams.id, id), eq(teams.orgId, orgId)));
  revalidatePath(`/perf/${performanceId}`);
}
