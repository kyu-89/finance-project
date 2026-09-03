'use client';

import { budgetStatus, calculateMonthlyClosing } from '@/lib/budget-calculations';
import type { Budget } from '@/lib/budgets';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { Transaction } from '@/lib/transactions';

const STATUS = {
  safe: { label: '안정', color: 'text-[var(--tds-blue-500)]' },
  caution: { label: '주의 · 70% 이상', color: 'text-amber-600' },
  near: { label: '임박 · 90% 이상', color: 'text-orange-600' },
  over: { label: '초과 · 100% 이상', color: 'text-[var(--tds-red-500)]' },
} as const;

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const percent = (value: number | null) => value === null ? '-' : `${(value * 100).toFixed(1)}%`;

export function BudgetClosingTab({ transactions, categories, budgets }: { transactions: Transaction[]; categories: CategoryWithSubcategories[]; budgets: Budget[] }) {
  const closing = calculateMonthlyClosing(transactions, budgets.map((budget) => ({ transactionType: budget.transactionType, categoryId: budget.categoryId, amount: budget.amount })));
  const budgetByCategory = new Map(budgets.filter((budget) => budget.transactionType === 'expense' && budget.categoryId).map((budget) => [budget.categoryId!, budget.amount]));
  // 2026-09: 저축/투자/대출원금상환/금융비용은 이제 별도 flow_class가 아니라 지출의 하위 카테고리라
  // 소비성지출에 이미 포함돼 있다. 그래서 생활수지·자산형성액·저축률처럼 저축과 소비가 분리돼
  // 있어야만 의미 있던 지표는 걷어내고, 총수입/소비성지출/현금잔여액 중심으로 단순화했다.
  const metrics = [
    ['총수입', won(closing.income)], ['소비성지출', won(closing.consumption)],
    ['현금잔여액', won(closing.cashRemaining)],
    ['수입 예산차', won(closing.incomeVariance)],
    ['소비율', percent(closing.consumptionRate)],
  ];
  const primaryMetrics = metrics.filter(([label]) => ['총수입', '소비성지출', '현금잔여액'].includes(label));
  const detailMetrics = metrics.filter(([label]) => !['총수입', '소비성지출', '현금잔여액'].includes(label));
  const insight = closing.income === 0 && closing.consumption === 0 ? '아직 확정된 거래가 없어요. 이번 달 수입과 지출을 입력하면 분석이 시작됩니다.' : closing.cashRemaining >= 0 ? `이번 달 현금잔여액 ${won(closing.cashRemaining)}로 흑자예요.` : `이번 달 지출이 수입보다 ${won(Math.abs(closing.cashRemaining))} 많아요. 고정비와 예정 거래를 먼저 점검해 보세요.`;
  return <div className="flex flex-col gap-5">
    <section className="monthly-report-lead"><p className="monthly-kicker">이번 달 분석 리포트</p><h2>{insight}</h2><p>확정된 거래를 기준으로 계산했어요. 예정 거래는 확정·제외 처리한 뒤 다시 확인할 수 있습니다.</p></section>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3">{primaryMetrics.map(([label, value]) => <div key={label} className="tds-card p-4">
      <p className="text-xs text-[var(--tds-grey-500)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
    </div>)}</section>
    <details className="monthly-report-details"><summary>상세 지표 {detailMetrics.length}개 보기</summary><section className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3">{detailMetrics.map(([label, value]) => <div key={label} className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></div>)}</section></details>
    <section className="tds-card p-5"><div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 className="text-lg font-bold">소비 예산</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">예산 {won(closing.budgetTotal)} · 잔액 {won(closing.budgetRemaining)}</p></div>
      <strong className="text-lg tabular-nums">소진율 {percent(closing.budgetUsageRate)}</strong></div>
    </section>
    <ul className="list-surface flex flex-col divide-y divide-[var(--tds-grey-200)]">{categories.map((category) => {
      const budget = budgetByCategory.get(category.id) ?? 0;
      const spent = closing.spentByCategory[category.id] ?? 0;
      const state = STATUS[budgetStatus(spent, budget)];
      return <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div><p className="font-semibold">{category.name}</p><p className={`mt-1 text-xs font-semibold ${state.color}`}>{state.label}</p></div>
        <div className="text-right text-sm tabular-nums"><p>{won(spent)} / {won(budget)}</p><p className="mt-1 text-[var(--tds-grey-500)]">남음 {won(budget - spent)}</p></div>
      </li>;
    })}</ul>
  </div>;
}
