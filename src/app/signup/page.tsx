import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signUpWithPassword } from '@/app/auth/actions';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export default async function SignupPage() {
  if (await getUser()) redirect('/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-4 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
          <p className="mt-1.5 text-sm text-mut">이메일·아이디·비밀번호로 가입하세요</p>
        </div>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <form action={signUpWithPassword} className="flex flex-col gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="이메일"
            autoComplete="email"
            className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
          />
          <input
            name="username"
            required
            minLength={3}
            maxLength={20}
            placeholder="아이디 (영소문자·숫자·_ 3~20자)"
            autoComplete="username"
            className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="비밀번호 (6자 이상)"
            autoComplete="new-password"
            className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
          >
            가입하기
          </button>
        </form>

        <Link
          href="/login"
          className="text-center text-sm text-mut underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          이미 계정이 있으신가요? 로그인 →
        </Link>
      </div>
    </main>
  );
}
