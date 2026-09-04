import { MenuCard } from '@/components/MenuCard';

const settingsItems = [
  ['재무 목표·일정', '재무 목표와 가족의 주요 일정을 함께 관리해요.', '/settings/planning'],
  ['카테고리 관리', '수입·지출의 대분류와 소분류를 관리해요.', '/settings/categories'],
  ['결제수단 관리', '거래에 사용할 카드·계좌·현금을 관리해요.', '/settings/payment-methods'],
  ['거래 내역 가져오기', '거래 데이터를 가져오고 내보내거나 검토해요.', '/settings/data'],
  ['예산 관리', '카테고리별 예산과 실제 지출을 비교해요.', '/settings/budgets'],
  ['반복 거래 관리', '매달 반복되는 거래와 예정 거래를 관리해요.', '/settings/recurring'],
] as const;

export function SettingsNav({ reviewCount = 0 }: { reviewCount?: number }) {
  const reviewItem = reviewCount > 0
    ? ['검토 필요 거래', `${reviewCount}건의 거래를 확인하고 정리해요.`, '/review'] as const
    : null;

  return <nav aria-label="설정 메뉴" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {reviewItem && <MenuCard href={reviewItem[2]} title={reviewItem[0]} description={reviewItem[1]} tone="warning" />}
    {settingsItems.map(([title, description, href]) => <MenuCard key={title} href={href} title={title} description={description} />)}
  </nav>;
}
