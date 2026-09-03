export type NavItem = {
  key: 'dashboard' | 'monthly' | 'analysis' | 'finance' | 'settings';
  label: string;
  href: string;
};

// 2026-09: 대시보드/분석/월간관리 정보구조 재정리(사용자 지시)로 5개 1차 메뉴로 확정.
// 대시보드=현황 요약/행동, 월간관리=입력·처리 전용, 분석=구조·추이 분석(연간·월간 토글), 자산·금융, 설정.
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '대시보드', href: '/dashboard' },
  { key: 'monthly', label: '월간관리', href: '/monthly' },
  { key: 'analysis', label: '분석', href: '/analysis' },
  { key: 'finance', label: '자산·금융', href: '/finance' },
  { key: 'settings', label: '설정', href: '/settings' },
];
