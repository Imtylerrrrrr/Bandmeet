'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS, SETTINGS_ITEM, isActive } from './nav-items';

// 데스크탑(md+) 인라인 네비. 모바일은 MobileNav 드로어가 담당.
export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, SETTINGS_ITEM] : NAV_ITEMS;

  return (
    <nav className="hidden items-center gap-0.5 md:flex">
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
              active
                ? 'bg-primary-soft text-primary-ink'
                : 'text-mut hover:bg-hover hover:text-ink'
            }`}
          >
            <Icon size={16} stroke={1.5} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
