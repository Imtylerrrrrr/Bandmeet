import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signInWithKakao, signInWithPassword } from '@/app/auth/actions';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export default async function LoginPage() {
  if (await getUser()) redirect('/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-4 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bandmeet</h1>
          <p className="mt-1.5 text-sm text-mut">되는 시간을 칠하면 합주가 자동으로 잡혀요</p>
        </div>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <form action={signInWithKakao}>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#FEE500] px-6 py-3 text-sm font-semibold text-[#191600] transition-[filter] duration-150 hover:brightness-95"
          >
            카카오로 로그인
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" />
          또는
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={signInWithPassword} className="flex flex-col gap-2">
          <input
            name="identifier"
            required
            placeholder="아이디 또는 이메일"
            autoComplete="username"
            className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="비밀번호"
            autoComplete="current-password"
            className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
          >
            로그인
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-mut">
          <Link
            href="/signup"
            className="underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            회원가입
          </Link>
          <Link
            href="/forgot-password"
            className="underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            비밀번호 찾기
          </Link>
        </div>

        <Link
          href="/demo"
          className="text-center text-sm text-mut underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          로그인 없이 둘러보기 →
        </Link>
      </div>
    </main>
  );
}
