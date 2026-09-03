'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, Home, Plus, Settings, WalletCards, type LucideIcon } from 'lucide-react';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/monthly', label: '거래', icon: CalendarDays },
  { href: '/quick-add', label: '추가', icon: Plus },
  { href: '/analysis', label: '분석', icon: BarChart3 },
  { href: '/finance', label: '자산', icon: WalletCards },
  { href: '/settings', label: '설정', icon: Settings },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  return <nav aria-label="주요 메뉴" className="mobile-lnb fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] items-stretch border-t border-[var(--tds-grey-200)] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_oklch(0.155_0.06_261/0.08)] backdrop-blur md:hidden">
    {MOBILE_ITEMS.map((item) => { const selected = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)); const isAction = item.href === '/quick-add'; const Icon: LucideIcon = item.icon; return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} aria-label={isAction ? item.label : undefined} className={`mobile-lnb-item ${isAction ? 'mobile-lnb-action' : ''} ${selected && !isAction ? 'is-selected' : ''}`}><span className="mobile-lnb-icon" aria-hidden="true"><Icon size="var(--icon-lg)" strokeWidth={1.8} /></span>{!isAction && <span>{item.label}</span>}</Link>; })}
  </nav>;
}
