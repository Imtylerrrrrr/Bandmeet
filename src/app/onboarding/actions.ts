'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, orgs, profiles } from '@/lib/db/schema';
import { ACTIVE_ORG_COOKIE } from '@/lib/org';

/** 가입 트리거가 보통 profiles 를 만들지만, 백스톱으로 보장. */
async function ensureProfile(userId: string, name: string) {
  await db.insert(profiles).values({ id: userId, name }).onConflictDoNothing();
}

function userName(user: { user_metadata?: Record<string, unknown>; email?: string }) {
  const meta = user.user_metadata ?? {};
  return (
    (meta.name as string) ??
    (meta.full_name as string) ??
    user.email ??
    '사용자'
  );
}

async function setActive(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

/** 동아리 생성 → 생성자는 운영진. */
export async function createOrg(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('동아리 이름을 입력하세요.');

  await ensureProfile(user.id, userName(user));

  // 고유 초대코드(8 hex). 충돌 시 재시도.
  let inviteCode = randomBytes(4).toString('hex');
  for (let i = 0; i < 5; i++) {
    const dup = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.inviteCode, inviteCode));
    if (dup.length === 0) break;
    inviteCode = randomBytes(4).toString('hex');
  }

  const [org] = await db
    .insert(orgs)
    .values({ name, inviteCode })
    .returning({ id: orgs.id });
  await db
    .insert(memberships)
    .values({ userId: user.id, orgId: org.id, role: 'admin' });

  await setActive(org.id);
  redirect('/');
}

/** 초대 코드로 가입 → 부원. */
export async function joinOrg(formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get('code') ?? '')
    .trim()
    .toLowerCase();
  if (!code) throw new Error('초대 코드를 입력하세요.');

  const [org] = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.inviteCode, code));
  if (!org) throw new Error('유효하지 않은 초대 코드입니다.');

  await ensureProfile(user.id, userName(user));
  await db
    .insert(memberships)
    .values({ userId: user.id, orgId: org.id, role: 'member' })
    .onConflictDoNothing();

  await setActive(org.id);
  redirect('/');
}
