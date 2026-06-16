import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requestPasswordReset } from '@/app/auth/actions';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  if (await getUser()) redirect('/');
  const { sent } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-4 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">비밀번호 찾기</h1>
          <p className="mt-1.5 text-sm text-mut">가입한 이메일로 재설정 링크를 보내드려요</p>
        </div>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        {sent ? (
          <p className="rounded-lg border bg-surface px-3 py-3 text-center text-sm text-mut">
            재설정 메일을 보냈어요. 메일함을 확인하세요.
          </p>
        ) : (
          <form action={requestPasswordReset} className="flex flex-col gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="이메일"
              autoComplete="email"
              className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              재설정 메일 받기
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="text-center text-sm text-mut underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          로그인으로 돌아가기 →
        </Link>
      </div>
    </main>
  );
}
