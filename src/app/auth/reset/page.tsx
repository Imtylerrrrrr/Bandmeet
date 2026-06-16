import Link from 'next/link';

import { updatePassword } from '@/app/auth/actions';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export default async function ResetPasswordPage() {
  const user = await getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-4 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <h1 className="text-2xl font-semibold tracking-tight">새 비밀번호 설정</h1>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        {user ? (
          <form action={updatePassword} className="flex flex-col gap-2">
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="새 비밀번호 (6자 이상)"
              autoComplete="new-password"
              className="w-full rounded-lg border bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              비밀번호 변경
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border bg-surface px-3 py-3 text-center text-sm text-mut">
              링크가 만료되었거나 올바르지 않아요. 다시 시도해 주세요.
            </p>
            <Link
              href="/forgot-password"
              className="text-center text-sm text-mut underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              비밀번호 찾기 →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
