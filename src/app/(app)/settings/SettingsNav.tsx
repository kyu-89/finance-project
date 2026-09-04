import { MenuCard } from '@/components/MenuCard';

const items = [
  ['재무 목표', '목표 금액과 진행 상황', '/settings/goals'],
  ['재무 일정', '기념일과 금융 점검 일정', '/settings/tasks'],
  ['카테고리 관리', '수입·지출 분류와 소분류', '/settings/categories'],
  ['결제수단 관리', '카드·계좌·현금 결제수단', '/settings/payment-methods'],
  ['거래 내역 가져오기', '엑셀·CSV·백업 데이터', '/settings/data'],
  ['예산 관리', '연간 예산과 월별 목표', '/settings/budgets'],
  ['반복 거래 관리', '예정 거래와 정기 지출', '/settings/recurring'],
] as const;

const SETTINGS_COPY = [
  ['재무 목표', '목표 금액과 달성 현황을 관리해요.'],
  ['재무 일정', '기념일과 금융 일정을 관리해요.'],
  ['카테고리 관리', '수입·지출의 대분류와 소분류를 관리해요.'],
  ['결제수단 관리', '거래에 사용할 카드·계좌·현금을 관리해요.'],
  ['거래 내역 가져오기', '거래 데이터를 가져오고 내보내거나 검토해요.'],
  ['예산 관리', '카테고리별 예산과 실제 지출을 비교해요.'],
  ['반복 거래 관리', '매달 반복되는 거래와 예정 거래를 관리해요.'],
] as const;
const settingsItems = items.map(([, , href], index) => [SETTINGS_COPY[index][0], SETTINGS_COPY[index][1], href] as const);

// 2026-09 Excel migration follow-up: shown only while there is at least one needs_review=true
// transaction left (see review/page.tsx) — once everything is reviewed, this entry disappears
// from the settings menu on its own rather than needing to be removed by hand later.
export function SettingsNav({ reviewCount = 0 }: { reviewCount?: number }) {
  const reviewItem = reviewCount > 0 ? ([`검토 필요 거래 (${reviewCount})`, '자동 판단하지 못한 거래를 확인하고 정리하세요', '/review'] as const) : null;
  return <nav aria-label="설정 메뉴" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {reviewItem && <MenuCard href={reviewItem[2]} title={reviewItem[0]} description={reviewItem[1]} tone="warning" />}
    {settingsItems.map(([title, description, href]) => <MenuCard key={title} href={href} title={title} description={description} />)}
  </nav>;
}
