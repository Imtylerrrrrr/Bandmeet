import { eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { db } from '@/lib/db';
import { chatBindings } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { removeBinding, setBinding } from './actions';

export default async function SettingsPage() {
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const [binding] = await db
    .select({ roomName: chatBindings.roomName })
    .from(chatBindings)
    .where(eq(chatBindings.orgId, active.orgId));

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <h1 className="text-lg font-bold">설정</h1>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">카톡 봇 단톡방 연결</h2>
            <p className="mt-1 text-xs text-gray-500">
              사설 봇(메신저봇R)이 게시·조회할 단톡방을 동아리에 연결합니다. 봇이 보는{' '}
              <b>단톡방 이름</b>을 정확히 입력하세요. (봇은 알림·조회만 — 명령으로 일정을 바꾸지
              않습니다.)
            </p>
          </div>

          <div className="rounded-lg border p-3 text-sm">
            현재 연결:{' '}
            {binding ? (
              <b>{binding.roomName}</b>
            ) : (
              <span className="text-gray-400">연결 안 됨</span>
            )}
          </div>

          {isAdmin ? (
            <div className="flex flex-col gap-2">
              <form action={setBinding} className="flex gap-2">
                <input type="hidden" name="orgId" value={active.orgId} />
                <input
                  name="roomName"
                  required
                  defaultValue={binding?.roomName ?? ''}
                  placeholder="단톡방 이름"
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  연결
                </button>
              </form>
              {binding && (
                <form action={removeBinding}>
                  <input type="hidden" name="orgId" value={active.orgId} />
                  <button className="text-xs text-red-600 hover:underline">연결 해제</button>
                </form>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">단톡 연결은 운영진만 설정할 수 있습니다.</p>
          )}
        </section>
      </main>
    </>
  );
}
