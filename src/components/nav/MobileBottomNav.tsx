'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, Home, Plus, Settings, WalletCards, type LucideIcon } from 'lucide-react';

// 2026-09(사용자 지시): 분석 메뉴 추가로 LNB가 5개(+추가 버튼 제외)가 되면서 "+"가 그 사이에
// 끼어 있는 게 어색해졌다 — "+"를 LNB 줄에서 빼고, 화면 전체 기준 우하단(LNB 영역 위)에 떠
// 있는 별도 플로팅 버튼으로 옮긴다. LNB는 이제 순수 5개 탐색 메뉴만 갖는다.
const MOBILE_ITEMS = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/monthly', label: '거래', icon: CalendarDays },
  { href: '/analysis', label: '분석', icon: BarChart3 },
  { href: '/finance', label: '자산', icon: WalletCards },
  { href: '/settings', label: '설정', icon: Settings },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  return <>
    <Link href="/quick-add" aria-label="거래 추가" className="mobile-fab md:hidden"><Plus size="var(--icon-lg)" strokeWidth={2} /></Link>
    <nav aria-label="주요 메뉴" className="mobile-lnb fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[480px] items-stretch border-t border-[var(--tds-grey-200)] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_oklch(0.155_0.06_261/0.08)] backdrop-blur md:hidden">
      {MOBILE_ITEMS.map((item) => { const selected = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)); const Icon: LucideIcon = item.icon; return <Link key={item.href} href={item.href} aria-current={selected ? 'page' : undefined} className={`mobile-lnb-item ${selected ? 'is-selected' : ''}`}><span className="mobile-lnb-icon" aria-hidden="true"><Icon size="var(--icon-lg)" strokeWidth={1.8} /></span><span>{item.label}</span></Link>; })}
    </nav>
  </>;
}
