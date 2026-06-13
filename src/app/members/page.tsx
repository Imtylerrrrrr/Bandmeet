import { asc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, profiles } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { leaveOrg, removeMember, setMemberRole } from './actions';

export default async function MembersPage() {
  const user = await requireUser();
  const { active, all } = await requireActiveOrg();
  const isAdmin = active.role === 'admin';

  const rows = await db
    .select({
      userId: memberships.userId,
      name: profiles.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(profiles, eq(memberships.userId, profiles.id))
    .where(eq(memberships.orgId, active.orgId))
    .orderBy(asc(memberships.role), asc(profiles.name));

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <h1 className="text-lg font-bold">멤버 ({rows.length})</h1>

        {isAdmin && (
          <section className="rounded-lg border bg-gray-50 p-4">
            <div className="text-sm font-semibold">초대 코드</div>
            <code className="mt-1 inline-block rounded bg-white px-2 py-1 font-mono text-sm">
              {active.inviteCode}
            </code>
            <p className="mt-1 text-xs text-gray-500">
              부원에게 이 코드를 공유하세요. 가입 화면에서 입력하면 부원으로 합류합니다.
            </p>
          </section>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">이름</th>
              <th className="py-2">역할</th>
              <th className="py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const isSelf = m.userId === user.id;
              return (
                <tr key={m.userId} className="border-b">
                  <td className="py-2">
                    {m.name}
                    {isSelf && <span className="ml-1 text-xs text-gray-400">(나)</span>}
                  </td>
                  <td className="py-2">{m.role === 'admin' ? '운영진' : '부원'}</td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      {isAdmin && !isSelf && (
                        <>
                          <form action={setMemberRole}>
                            <input type="hidden" name="orgId" value={active.orgId} />
                            <input type="hidden" name="userId" value={m.userId} />
                            <input
                              type="hidden"
                              name="role"
                              value={m.role === 'admin' ? 'member' : 'admin'}
                            />
                            <button className="text-xs text-blue-600 hover:underline">
                              {m.role === 'admin' ? '부원으로' : '운영진으로'}
                            </button>
                          </form>
                          <form action={removeMember}>
                            <input type="hidden" name="orgId" value={active.orgId} />
                            <input type="hidden" name="userId" value={m.userId} />
                            <button className="text-xs text-red-600 hover:underline">
                              제거
                            </button>
                          </form>
                        </>
                      )}
                      {isSelf && (
                        <form action={leaveOrg}>
                          <input type="hidden" name="orgId" value={active.orgId} />
                          <button className="text-xs text-red-600 hover:underline">
                            나가기
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </>
  );
}
