import Link from 'next/link';
import { IconLogout } from '@tabler/icons-react';

import { signOut } from '@/app/auth/actions';
import { switchOrg } from '@/lib/org-actions';
import type { OrgMembership } from '@/lib/org';
import { NavLinks } from './NavLinks';
import { Logo } from './Logo';

const ROLE_LABEL: Record<string, string> = { admin: '운영진', member: '부원' };

export function AppHeader({
  active,
  all,
}: {
  active: OrgMembership;
  all: OrgMembership[];
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="text-[15px] font-semibold tracking-tight">Bandmeet</span>
          </Link>
          <span className="hidden text-sm text-mut sm:inline">{active.orgName}</span>
          <span className="rounded-md bg-hover px-1.5 py-0.5 text-[11px] font-medium text-mut">
            {ROLE_LABEL[active.role] ?? active.role}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavLinks isAdmin={active.role === 'admin'} />

          <div className="flex items-center gap-1.5">
            {all.length > 1 && (
              <form action={switchOrg} className="flex items-center gap-1">
                <select
                  name="orgId"
                  defaultValue={active.orgId}
                  className="rounded-lg border bg-surface px-2 py-1.5 text-[13px] text-mut transition-colors duration-150 hover:border-line-strong"
                >
                  {all.map((o) => (
                    <option key={o.orgId} value={o.orgId}>
                      {o.orgName}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary transition-colors duration-150 hover:bg-primary-soft"
                >
                  전환
                </button>
              </form>
            )}

            <form action={signOut}>
              <button
                type="submit"
                title="로그아웃"
                aria-label="로그아웃"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                <IconLogout size={17} stroke={1.5} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
