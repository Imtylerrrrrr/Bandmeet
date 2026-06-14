'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';

export async function signInWithKakao() {
  const supabase = await createClient();
  const origin = (await headers()).get('origin') ?? '';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) throw error;
  if (data.url) redirect(data.url);
}

/**
 * 게스트로 시작(카카오 없이 이름만). Supabase 익명 세션 + 프로필 이름 설정 후 홈('/')으로(미가입이면 홈에서 온보딩으로).
 * Supabase Authentication 에서 'Anonymous sign-ins' 가 켜져 있어야 동작.
 */
export async function signInAsGuest(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 20) || '게스트';
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { name } },
  });
  if (error) {
    throw new Error(
      '게스트 시작에 실패했어요. (Supabase 익명 로그인 활성화가 필요합니다)',
    );
  }

  // 가입 트리거가 빈 이름으로 만들 수 있어 입력한 이름으로 보정.
  const uid = data.user?.id;
  if (uid) {
    await db.update(profiles).set({ name }).where(eq(profiles.id, uid));
  }

  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
