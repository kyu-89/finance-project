'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: '홈', icon: 'home' },
  { href: '/monthly', label: '입력', icon: 'calendar' },
  { href: '/quick-add', label: '추가', icon: 'plus' },
  { href: '/finance', label: '자산', icon: 'wallet' },
  { href: '/settings', label: '설정', icon: 'settings' },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  return <nav aria-label="주요 메뉴" className="mobile-lnb fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] items-end border-t border-[var(--tds-grey-200)] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_oklch(0.155_0.06_261/0.08)] backdrop-blur md:hidden">
    {MOBILE_ITEMS.map((item) => {
      const selected = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
      const isAction = item.href === '/quick-add';
      return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} className={`mobile-lnb-item ${isAction ? 'mobile-lnb-action' : ''} ${selected && !isAction ? 'is-selected' : ''}`}>
        <span className="mobile-lnb-icon" aria-hidden="true"><NavIcon name={item.icon} /></span><span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}

function NavIcon({ name }: { name: (typeof MOBILE_ITEMS)[number]['icon'] }) {
  const common = { width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'home') return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M7 3v3M17 3v3M3 9h18M7 13h.01M11 13h.01M15 13h.01M7 17h.01M11 17h.01" /></svg>;
  if (name === 'wallet') return <svg {...common}><path d="M4 6.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h11" /><path d="M3 8h16M16 14h3" /><circle cx="16" cy="14" r=".7" fill="currentColor" stroke="none" /></svg>;
  if (name === 'settings') return <svg {...common}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.1h-2.55v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.1 15a1.7 1.7 0 0 0-1.56-1.03h-.1v-2.55h.1A1.7 1.7 0 0 0 8.1 10.4a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.1h2.55v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.1v2.55h-.1A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
  return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
}
