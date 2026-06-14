import { asc, eq } from 'drizzle-orm';

import { AppHeader } from '@/components/AppHeader';
import { CopyButton } from '@/components/CopyButton';
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
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
        <h1 className="text-[19px] font-semibold tracking-tight">
          멤버 <span className="font-normal text-mut">{rows.length}</span>
        </h1>

        {isAdmin && (
          <section className="flex flex-col gap-2 rounded-xl border bg-surface p-4">
            <div className="text-[15px] font-semibold">초대 코드</div>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-hover px-2.5 py-1.5 font-mono text-sm tracking-wider">
                {active.inviteCode}
              </code>
              <CopyButton text={active.inviteCode} label="코드 복사" />
            </div>
            <p className="text-xs text-mut">
              부원에게 이 코드를 공유하세요. 가입 화면에서 입력하면 부원으로 합류합니다.
            </p>
          </section>
        )}

        <ul className="flex flex-col">
          {rows.map((m) => {
            const isSelf = m.userId === user.id;
            return (
              <li
                key={m.userId}
                className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <Avatar name={m.name} />
                <span className="font-medium">{m.name}</span>
                {isSelf && <span className="text-xs text-faint">(나)</span>}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                    m.role === 'admin'
                      ? 'bg-primary-soft text-primary-ink'
                      : 'bg-hover text-mut'
                  }`}
                >
                  {m.role === 'admin' ? '운영진' : '부원'}
                </span>

                <div className="ml-auto flex items-center gap-3 text-xs">
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
                        <button className="font-medium text-primary transition-opacity duration-150 hover:opacity-70">
                          {m.role === 'admin' ? '부원으로' : '운영진으로'}
                        </button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="orgId" value={active.orgId} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <button className="font-medium text-danger-text transition-opacity duration-150 hover:opacity-70">
                          제거
                        </button>
                      </form>
                    </>
                  )}
                  {isSelf && (
                    <form action={leaveOrg}>
                      <input type="hidden" name="orgId" value={active.orgId} />
                      <button className="font-medium text-danger-text transition-opacity duration-150 hover:opacity-70">
                        나가기
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const ch = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
      {ch}
    </span>
  );
}
