'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome,
  IconCalendarMonth,
  IconMicrophone2,
  IconClock,
  IconUsers,
  IconBell,
  IconSettings,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

type Item = { href: string; label: string; Icon: ComponentType<IconProps> };

const ITEMS: Item[] = [
  { href: '/', label: '홈', Icon: IconHome },
  { href: '/calendar', label: '캘린더', Icon: IconCalendarMonth },
  { href: '/perf', label: '공연', Icon: IconMicrophone2 },
  { href: '/availability', label: '내 시간', Icon: IconClock },
  { href: '/members', label: '멤버', Icon: IconUsers },
  { href: '/notifications', label: '알림', Icon: IconBell },
];

const SETTINGS: Item = { href: '/settings', label: '설정', Icon: IconSettings };

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...ITEMS, SETTINGS] : ITEMS;

  return (
    <nav className="flex flex-wrap items-center gap-0.5">
      {items.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
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
