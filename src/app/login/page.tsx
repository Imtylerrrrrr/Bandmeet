import { redirect } from 'next/navigation';

import { signInWithKakao } from '@/app/auth/actions';
import { getUser } from '@/lib/auth';

export default async function LoginPage() {
  if (await getUser()) redirect('/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Bandmeet</h1>
        <p className="mt-2 text-sm text-gray-500">
          밴드 합주·회의 일정 자동 매칭
        </p>
      </div>
      <form action={signInWithKakao}>
        <button
          type="submit"
          className="rounded-md bg-[#FEE500] px-6 py-3 text-sm font-medium text-[#191600] hover:brightness-95"
        >
          카카오로 로그인
        </button>
      </form>
    </main>
  );
}
