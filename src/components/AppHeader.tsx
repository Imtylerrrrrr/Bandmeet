import Link from 'next/link';

import { signOut } from '@/app/auth/actions';
import { switchOrg } from '@/lib/org-actions';
import type { OrgMembership } from '@/lib/org';

const ROLE_LABEL: Record<string, string> = { admin: '운영진', member: '부원' };

export function AppHeader({
  active,
  all,
}: {
  active: OrgMembership;
  all: OrgMembership[];
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold">
            Bandmeet
          </Link>
          <span className="text-sm text-gray-600">{active.orgName}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {ROLE_LABEL[active.role] ?? active.role}
          </span>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">
            홈
          </Link>
          <Link href="/calendar" className="hover:underline">
            캘린더
          </Link>
          <Link href="/perf" className="hover:underline">
            공연
          </Link>
          <Link href="/availability" className="hover:underline">
            가용성
          </Link>
          <Link href="/members" className="hover:underline">
            멤버
          </Link>
          <Link href="/notifications" className="hover:underline">
            알림
          </Link>
          {active.role === 'admin' && (
            <Link href="/settings" className="hover:underline">
              설정
            </Link>
          )}

          {all.length > 1 && (
            <form action={switchOrg} className="flex items-center gap-1">
              <select
                name="orgId"
                defaultValue={active.orgId}
                className="rounded border px-1 py-0.5 text-xs"
              >
                {all.map((o) => (
                  <option key={o.orgId} value={o.orgId}>
                    {o.orgName}
                  </option>
                ))}
              </select>
              <button type="submit" className="text-xs text-blue-600 hover:underline">
                전환
              </button>
            </form>
          )}

          <form action={signOut}>
            <button type="submit" className="text-gray-500 hover:underline">
              로그아웃
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
