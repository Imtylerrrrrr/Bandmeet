'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACTIVE_ORG_COOKIE, requireMembership } from '@/lib/org';

/** 활성 org 전환(헤더 스위처). 멤버인 org 만 허용. */
export async function switchOrg(formData: FormData) {
  const orgId = String(formData.get('orgId') ?? '');
  if (orgId) {
    await requireMembership(orgId); // 멤버 검증
    (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
  redirect('/');
}
