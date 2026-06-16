'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';

import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import {
  isEmail,
  normalizeUsername,
  validateUsername,
} from '@/lib/auth/credentials';

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

/** 아이디 → 이메일 해석(서버 전용, postgres 권한 → RLS 우회). 없으면 null. */
async function resolveEmailByUsername(username: string): Promise<string | null> {
  const rows = (await db.execute(
    sql`select u.email from auth.users u
        join public.profiles p on p.id = u.id
        where p.username = ${username} limit 1`,
  )) as unknown as Array<{ email: string | null }>;
  return rows[0]?.email ?? null;
}

/** 회원가입: 이메일·아이디·비밀번호. 이메일 확인 비활성 전제(가입 즉시 로그인). */
export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const username = normalizeUsername(String(formData.get('username') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!isEmail(email)) throw new Error('올바른 이메일을 입력하세요.');
  const unameErr = validateUsername(username);
  if (unameErr) throw new Error(unameErr);
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');

  // 아이디 중복 사전 체크(DB 유니크 제약과 이중 방어).
  const dup = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, username));
  if (dup.length > 0) throw new Error('이미 사용 중인 아이디입니다.');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: username } },
  });
  if (error) {
    throw new Error(
      '회원가입에 실패했어요. 이메일이 이미 사용 중이거나 입력이 올바르지 않습니다.',
    );
  }

  // 가입 트리거가 profiles(name) 를 만든 뒤, 아이디 저장.
  const uid = data.user?.id;
  if (uid) {
    await db.update(profiles).set({ username }).where(eq(profiles.id, uid));
  }

  redirect('/');
}

/** 로그인: 아이디 또는 이메일 + 비밀번호. 아이디면 이메일로 해석 후 인증. */
export async function signInWithPassword(formData: FormData) {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!identifier || !password) {
    throw new Error('아이디(또는 이메일)와 비밀번호를 입력하세요.');
  }

  let email = identifier;
  if (!isEmail(identifier)) {
    const resolved = await resolveEmailByUsername(normalizeUsername(identifier));
    // 계정 열거 방지: 아이디 미존재도 제네릭 메시지.
    if (!resolved) throw new Error('로그인 정보가 올바르지 않습니다.');
    email = resolved;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('로그인 정보가 올바르지 않습니다.');

  redirect('/');
}

/** 비밀번호 찾기: 재설정 메일 발송. 존재 여부 비노출(성공/실패 동일 응답). */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!isEmail(email)) throw new Error('올바른 이메일을 입력하세요.');

  const supabase = await createClient();
  const origin = (await headers()).get('origin') ?? '';
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });

  redirect('/forgot-password?sent=1');
}

/** 재설정 링크로 들어온(복구 세션) 사용자의 새 비밀번호 적용. */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error('비밀번호 변경에 실패했어요. 링크가 만료되었을 수 있어요.');
  }

  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
