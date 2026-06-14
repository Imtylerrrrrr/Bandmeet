import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { IconBell } from '@tabler/icons-react';

import { AppHeader } from '@/components/AppHeader';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { requireActiveOrg } from '@/lib/org';
import { markAllRead } from './actions';

function ago(date: Date): string {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' });
}

export default async function NotificationsPage() {
  const { active, all } = await requireActiveOrg();
  const user = await requireUser();

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.orgId, active.orgId)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  const unread = rows.filter((n) => !n.readAt).length;

  return (
    <>
      <AppHeader active={active} all={all} />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
            알림
            {unread > 0 && (
              <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-medium tabular-nums text-primary-ink">
                {unread}
              </span>
            )}
          </h1>
          {unread > 0 && (
            <form action={markAllRead}>
              <input type="hidden" name="orgId" value={active.orgId} />
              <button className="text-[13px] font-medium text-primary transition-opacity duration-150 hover:opacity-70">
                모두 읽음
              </button>
            </form>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-surface px-6 py-12 text-center">
            <IconBell size={26} stroke={1.5} className="text-faint" />
            <p className="text-sm text-mut">알림이 없어요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((n) => {
              const inner = (
                <div
                  className={`rounded-xl border p-3.5 text-sm transition-colors duration-150 ${
                    n.readAt
                      ? 'bg-surface text-mut hover:bg-hover'
                      : 'border-primary/25 bg-primary-soft/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div>
                      <div className={n.readAt ? '' : 'text-ink'}>{n.body}</div>
                      <div className="mt-1 text-xs tabular-nums text-faint">{ago(n.createdAt)}</div>
                    </div>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </main>
    </>
  );
}
