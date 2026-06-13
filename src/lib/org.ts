import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { requireUser, type Role } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, orgs } from '@/lib/db/schema';

export const ACTIVE_ORG_COOKIE = 'bandmeet_active_org';

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: Role;
  inviteCode: string;
}

/**
 * 현재 사용자가 속한 모든 org (역할·초대코드 포함).
 * 앱 쿼리는 항상 org 스코프(여기선 본인 user_id) 로 명시한다 — RLS 는 백스톱.
 */
export async function getMyOrgs(userId: string): Promise<OrgMembership[]> {
  return db
    .select({
      orgId: orgs.id,
      orgName: orgs.name,
      role: memberships.role,
      inviteCode: orgs.inviteCode,
    })
    .from(memberships)
    .innerJoin(orgs, eq(memberships.orgId, orgs.id))
    .where(eq(memberships.userId, userId));
}

/** 활성 org 컨텍스트. 소속 org 가 하나도 없으면 null. */
export async function getActiveOrg(): Promise<{
  active: OrgMembership;
  all: OrgMembership[];
} | null> {
  const user = await requireUser();
  const all = await getMyOrgs(user.id);
  if (all.length === 0) return null;

  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = all.find((o) => o.orgId === wanted) ?? all[0];
  return { active, all };
}

/** 활성 org 필수. 소속 org 가 없으면 /onboarding 으로. */
export async function requireActiveOrg() {
  const ctx = await getActiveOrg();
  if (!ctx) redirect('/onboarding');
  return ctx;
}

/** 특정 org 멤버십 확인(서버 액션 권한 가드). 비멤버면 /onboarding. */
export async function requireMembership(
  orgId: string,
): Promise<{ userId: string; role: Role }> {
  const user = await requireUser();
  const rows = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.orgId, orgId)));
  if (rows.length === 0) redirect('/onboarding');
  return { userId: user.id, role: rows[0].role };
}

/** 운영진 전용 가드. */
export async function requireOrgAdmin(orgId: string) {
  const m = await requireMembership(orgId);
  if (m.role !== 'admin') throw new Error('운영진 권한이 필요합니다.');
  return m;
}
