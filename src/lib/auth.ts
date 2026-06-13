import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type Role = 'admin' | 'member'; // 운영진 / 부원
export interface Membership {
  orgId: string;
  role: Role;
}

/** 현재 로그인 사용자 (없으면 null). */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** 로그인 필수. 미로그인 시 /login 으로 리다이렉트. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/** 현재 사용자의 org 멤버십 목록 (RLS 로 본인 것만 조회됨). */
export async function getMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('memberships').select('org_id, role');
  return (data ?? []).map((m) => ({ orgId: m.org_id, role: m.role as Role }));
}

/** 특정 org 에서 역할 가드. role='admin' 이면 운영진만 통과. */
export async function requireRole(orgId: string, role: Role = 'member') {
  await requireUser();
  const membership = (await getMemberships()).find((m) => m.orgId === orgId);
  if (!membership) redirect('/login');
  if (role === 'admin' && membership.role !== 'admin') {
    throw new Error('운영진 권한이 필요합니다.');
  }
  return membership;
}
