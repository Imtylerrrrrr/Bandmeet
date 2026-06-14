import { eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { db } from '@/lib/db';
import { chatBindings } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { removeBinding, renameOrg, setBinding } from './actions';

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
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="text-[19px] font-semibold tracking-tight">설정</h1>

        {isAdmin && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-semibold">동아리 이름</h2>
            <form action={renameOrg} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="orgId" value={active.orgId} />
              <input
                name="name"
                required
                maxLength={40}
                defaultValue={active.orgName}
                className="w-full rounded-lg border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:border-line-strong sm:flex-1"
              />
              <Button type="submit" variant="primary">
                저장
              </Button>
            </form>
            <p className="text-xs text-mut">헤더·전 화면에 바로 반영됩니다.</p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">카톡 봇 단톡방 연결</h2>
            <p className="mt-1 text-xs text-mut">
              사설 봇(메신저봇R)이 게시·조회할 단톡방을 동아리에 연결합니다. 봇이 보는{' '}
              <b className="font-medium text-ink">단톡방 이름</b>을 정확히 입력하세요. (봇은 알림·조회만 —
              명령으로 일정을 바꾸지 않습니다.)
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border bg-surface p-3.5 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                binding ? 'bg-primary' : 'bg-faint'
              }`}
            />
            현재 연결:{' '}
            {binding ? (
              <b className="font-semibold">{binding.roomName}</b>
            ) : (
              <span className="text-faint">연결 안 됨</span>
            )}
          </div>

          {isAdmin ? (
            <div className="flex flex-col gap-2">
              <form action={setBinding} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="orgId" value={active.orgId} />
                <input
                  name="roomName"
                  required
                  defaultValue={binding?.roomName ?? ''}
                  placeholder="단톡방 이름"
                  className="w-full rounded-lg border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:border-line-strong sm:flex-1"
                />
                <Button type="submit" variant="primary">
                  연결
                </Button>
              </form>
              {binding && (
                <form action={removeBinding}>
                  <input type="hidden" name="orgId" value={active.orgId} />
                  <Button type="submit" variant="danger" size="sm">
                    연결 해제
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <p className="text-xs text-faint">단톡 연결은 운영진만 설정할 수 있습니다.</p>
          )}
        </section>
      </main>
    </>
  );
}
