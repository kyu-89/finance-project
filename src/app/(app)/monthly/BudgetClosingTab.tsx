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
  // PRD §36: 생활수지, 현금잔여액, 자산형성액, 순자산은 각각 별도의 KPI다. A single "월 차액"
  // used to stand in for all of them while silently ignoring 대출원금·금융비용·투자, which
  // overstated spare cash for any household with a loan.
  const metrics = [
    ['총수입', won(closing.income)], ['소비성지출', won(closing.consumption)], ['금융비용', won(closing.financeCost)],
    ['생활수지', won(closing.livingBalance)],
    ['저축', won(closing.saving)], ['투자', won(closing.investment)], ['대출원금상환', won(closing.debtPrincipal)],
    ['자산형성액', won(closing.wealthBuilt)], ['자산형성률', percent(closing.wealthBuildingRate)],
    ['현금잔여액', won(closing.cashRemaining)],
    ['수입 예산차', won(closing.incomeVariance)], ['저축 예산차', won(closing.savingVariance)],
    ['저축률', percent(closing.savingsRate)], ['목표 저축률', percent(closing.targetSavingsRate)],
    ['목표 대비 저축률', closing.savingsRateVariance === null ? '-' : `${closing.savingsRateVariance >= 0 ? '+' : ''}${(closing.savingsRateVariance * 100).toFixed(1)}%p`],
    ['소비율', percent(closing.consumptionRate)],
  ];
  return <div className="flex flex-col gap-5">
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="tds-card p-4">
      <p className="text-xs text-[var(--tds-grey-500)]">{label}</p><p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
    </div>)}</section>
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
