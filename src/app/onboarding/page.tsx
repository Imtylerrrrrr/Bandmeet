import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getMyOrgs } from '@/lib/org';
import { Logo } from '@/components/Logo';
import { createOrg, joinOrg } from './actions';

export default async function OnboardingPage() {
  const user = await requireUser();
  // 이미 소속 org 가 있으면 홈으로.
  if ((await getMyOrgs(user.id)).length > 0) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 bg-canvas p-8">
      <div className="flex items-center gap-3">
        <Logo size={36} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">시작하기</h1>
          <p className="mt-0.5 text-sm text-mut">동아리를 새로 만들거나, 초대 코드로 가입하세요.</p>
        </div>
      </div>

      <form action={createOrg} className="flex flex-col gap-3 rounded-xl border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">동아리 만들기 (운영진)</h2>
        <input
          name="name"
          required
          placeholder="동아리 이름"
          className="rounded-lg border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:border-line-strong"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
        >
          만들기
        </button>
      </form>

      <form action={joinOrg} className="flex flex-col gap-3 rounded-xl border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">초대 코드로 가입 (부원)</h2>
        <input
          name="code"
          required
          placeholder="초대 코드 (예: a1b2c3d4)"
          className="rounded-lg border bg-surface px-3 py-2 font-mono text-sm tracking-wider transition-colors duration-150 hover:border-line-strong"
        />
        <button
          type="submit"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150 hover:bg-hover"
        >
          가입하기
        </button>
      </form>
    </main>
  );
}
