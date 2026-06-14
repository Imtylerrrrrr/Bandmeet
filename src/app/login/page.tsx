import { redirect } from 'next/navigation';

import { signInWithKakao } from '@/app/auth/actions';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export default async function LoginPage() {
  if (await getUser()) redirect('/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bandmeet</h1>
          <p className="mt-1.5 text-sm text-mut">되는 시간을 칠하면 합주가 자동으로 잡혀요</p>
        </div>
      </div>
      <form action={signInWithKakao}>
        <button
          type="submit"
          className="rounded-lg bg-[#FEE500] px-6 py-3 text-sm font-semibold text-[#191600] transition-[filter] duration-150 hover:brightness-95"
        >
          카카오로 로그인
        </button>
      </form>
    </main>
  );
}
