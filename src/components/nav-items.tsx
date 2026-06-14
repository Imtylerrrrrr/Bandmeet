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

// 데스크탑 인라인 네비(NavLinks)와 모바일 드로어(MobileNav)가 공유하는 항목.
export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '홈', Icon: IconHome },
  { href: '/calendar', label: '캘린더', Icon: IconCalendarMonth },
  { href: '/perf', label: '공연', Icon: IconMicrophone2 },
  { href: '/availability', label: '내 시간', Icon: IconClock },
  { href: '/members', label: '멤버', Icon: IconUsers },
  { href: '/notifications', label: '알림', Icon: IconBell },
];

export const SETTINGS_ITEM: NavItem = {
  href: '/settings',
  label: '설정',
  Icon: IconSettings,
};

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}
