'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconMenu2, IconX, IconLogout } from '@tabler/icons-react';

import { signOut } from '@/app/auth/actions';
import { switchOrg } from '@/lib/org-actions';
import type { OrgMembership } from '@/lib/org';
import { NAV_ITEMS, SETTINGS_ITEM, isActive } from './nav-items';

const ROLE_LABEL: Record<string, string> = { admin: '운영진', member: '부원' };

// 모바일(<md) 햄버거 → 좌측 슬라이드 드로어. 네비·org 전환·로그아웃을 한곳에.
export function MobileNav({
  isAdmin,
  active,
  all,
}: {
  isAdmin: boolean;
  active: OrgMembership;
  all: OrgMembership[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, SETTINGS_ITEM] : NAV_ITEMS;

  // 열렸을 때 Esc 닫기 + 바디 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors duration-150 hover:bg-hover"
      >
        <IconMenu2 size={20} stroke={1.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{active.orgName}</span>
                <span className="text-xs text-mut">
                  {ROLE_LABEL[active.role] ?? active.role}
                </span>
              </div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                <IconX size={18} stroke={1.5} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {items.map(({ href, label, Icon }) => {
                const act = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={act ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      act
                        ? 'bg-primary-soft text-primary-ink'
                        : 'text-ink hover:bg-hover'
                    }`}
                  >
                    <Icon size={19} stroke={1.5} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-2 border-t p-3">
              {all.length > 1 && (
                <form action={switchOrg} className="flex gap-2">
                  <select
                    name="orgId"
                    defaultValue={active.orgId}
                    className="min-w-0 flex-1 rounded-lg border bg-surface px-2 py-2 text-sm"
                  >
                    {all.map((o) => (
                      <option key={o.orgId} value={o.orgId}>
                        {o.orgName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-ink"
                  >
                    전환
                  </button>
                </form>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border bg-surface px-3 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover"
                >
                  <IconLogout size={17} stroke={1.5} />
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
