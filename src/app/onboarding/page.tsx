import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getMyOrgs } from '@/lib/org';
import { createOrg, joinOrg } from './actions';

export default async function OnboardingPage() {
  const user = await requireUser();
  // 이미 소속 org 가 있으면 홈으로.
  if ((await getMyOrgs(user.id)).length > 0) redirect('/');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-8">
      <div>
        <h1 className="text-xl font-bold">시작하기</h1>
        <p className="mt-1 text-sm text-gray-500">
          동아리를 새로 만들거나, 초대 코드로 가입하세요.
        </p>
      </div>

      <form action={createOrg} className="flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">동아리 만들기 (운영진)</h2>
        <input
          name="name"
          required
          placeholder="동아리 이름"
          className="rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          만들기
        </button>
      </form>

      <form action={joinOrg} className="flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">초대 코드로 가입 (부원)</h2>
        <input
          name="code"
          required
          placeholder="초대 코드 (예: a1b2c3d4)"
          className="rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          가입하기
        </button>
      </form>
    </main>
  );
}
