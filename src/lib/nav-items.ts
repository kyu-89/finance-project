export type NavItem = {
  key: 'dashboard' | 'monthly' | 'finance' | 'settings';
  label: string;
  href: string;
};

// The 4 first-level menus mandated by PRD §0.13 / §19.1 — do not add a 5th.
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '대시보드', href: '/dashboard' },
  { key: 'monthly', label: '월간관리', href: '/monthly' },
  { key: 'finance', label: '자산·금융', href: '/finance' },
  { key: 'settings', label: '설정', href: '/settings' },
];
