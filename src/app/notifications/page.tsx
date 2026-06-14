import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';

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
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">알림 {unread > 0 && <span className="text-blue-600">({unread})</span>}</h1>
          {unread > 0 && (
            <form action={markAllRead}>
              <input type="hidden" name="orgId" value={active.orgId} />
              <button className="text-sm text-blue-600 hover:underline">모두 읽음</button>
            </form>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">알림이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((n) => {
              const inner = (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    n.readAt ? 'bg-white text-gray-600' : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    <div>
                      <div>{n.body}</div>
                      <div className="mt-1 text-xs text-gray-400">{ago(n.createdAt)}</div>
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
