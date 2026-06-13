import { signOut } from '@/app/auth/actions';
import { getMemberships, getUser } from '@/lib/auth';

export default async function Home() {
  const user = await getUser();
  const memberships = user ? await getMemberships() : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bandmeet</h1>
        {user ? (
          <form action={signOut}>
            <button type="submit" className="text-sm text-gray-500 hover:underline">
              로그아웃
            </button>
          </form>
        ) : (
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            로그인
          </a>
        )}
      </header>

      {user ? (
        <section className="flex flex-col gap-2">
          <p className="text-sm">
            <span className="text-gray-500">로그인: </span>
            {user.email ?? user.id}
          </p>
          <p className="text-sm text-gray-500">
            소속 동아리 {memberships.length}개
          </p>
        </section>
      ) : (
        <p className="text-sm text-gray-500">
          로그인하면 합주 일정과 가용성을 관리할 수 있습니다.
        </p>
      )}
    </main>
  );
}
