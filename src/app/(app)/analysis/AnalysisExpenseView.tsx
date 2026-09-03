'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import type { Budget } from '@/lib/budgets';
import type { CategoryWithSubcategories } from '@/lib/categories';
import { budgetStatus } from '@/lib/budget-calculations';
import { summarizeExpenseByCategory, type AnalysisRow } from '@/lib/analysis';
import { AnalysisBarChart } from './AnalysisBarChart';
import { ExpenseDrilldown } from './AnalysisDrilldown';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const percent = (value: number | null) => value === null ? '-' : `${(value * 100).toFixed(1)}%`;
const STATUS_LABEL = { safe: '안정', caution: '주의 · 70% 이상', near: '임박 · 90% 이상', over: '초과 · 100% 이상' } as const;
const STATUS_COLOR = { safe: 'text-[var(--tds-blue-500)]', caution: 'text-amber-600', near: 'text-orange-600', over: 'text-[var(--tds-red-500)]' } as const;

// §8 — 지출 > 대분류 > 소분류 > 개별 거래. 저축성지출은 다른 대분류와 같은 층위의 항목 하나일
// 뿐이다(별도 계층·탭·차트 시리즈로 만들지 않음). 월간 화면에서는 예산 대비 실제 지출도 여기서
// 보여준다(BudgetClosingTab에서 이관된 로직 — §14).
export function AnalysisExpenseView({ scope, month, periodTransactions, categoryNames, subcategoryNames, budgets, categories, totals }: {
  scope: 'year' | 'month'; year: string; month: string; months: string[];
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  categoryNames: Map<string, string>; subcategoryNames: Map<string, string>;
  savingsCategoryId: string | null; budgets: Budget[]; categories: CategoryWithSubcategories[];
  totals: { expense: number };
}) {
  const rows = useMemo(() => summarizeExpenseByCategory(periodTransactions, categoryNames, subcategoryNames), [periodTransactions, categoryNames, subcategoryNames]);
  const flatRows: AnalysisRow[] = rows.map((r) => ({ id: r.id, label: r.label, value: r.value, count: r.count }));
  const transactionsFor = (categoryId: string, subcategoryId: string) => periodTransactions.filter((t) => t.status === 'posted' && t.flowClass === 'consumption' && (t.categoryId ?? 'unassigned') === categoryId && (t.subcategoryId ?? 'unassigned') === subcategoryId);

  const budgetMonth = Number(month.slice(5, 7));
  const budgetByCategory = new Map(budgets.filter((b) => b.month === budgetMonth && b.transactionType === 'expense' && b.categoryId).map((b) => [b.categoryId!, b.amount]));
  const budgetTotal = [...budgetByCategory.values()].reduce((sum, v) => sum + v, 0);
  const spentByCategory = new Map<string, number>();
  for (const t of periodTransactions) { if (t.status === 'posted' && t.flowClass === 'consumption' && t.includeInBudget && t.categoryId) spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount); }
  const budgetedSpent = [...spentByCategory.values()].reduce((sum, v) => sum + v, 0);

  return <div className="analysis-view flex flex-col gap-4">
    <AnalysisBarChart title="지출 구성" description="대분류별 금액과 비중이에요." rows={flatRows} tone="expense" />
    <section className="tds-card p-5"><h2 className="text-lg font-bold">지출 대분류</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">대분류를 누르면 소분류가, 소분류를 누르면 개별 거래가 펼쳐져요.</p><div className="mt-4"><ExpenseDrilldown rows={rows} total={totals.expense} transactionsFor={transactionsFor} /></div></section>
    {scope === 'month' && <section className="tds-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold">예산 대비 실제 지출</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">예산 {won(budgetTotal)} · 실제 {won(budgetedSpent)}</p></div><strong className="text-lg tabular-nums">소진율 {percent(budgetTotal > 0 ? budgetedSpent / budgetTotal : null)}</strong></div>
      <ul className="mt-4 flex flex-col divide-y divide-[var(--tds-grey-200)]">{categories.filter((c) => c.transactionType === 'expense').map((category) => {
        const budget = budgetByCategory.get(category.id) ?? 0; const spent = spentByCategory.get(category.id) ?? 0; if (budget === 0 && spent === 0) return null;
        const state = budgetStatus(spent, budget);
        return <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{category.name}</p><p className={`mt-1 text-xs font-semibold ${STATUS_COLOR[state]}`}>{STATUS_LABEL[state]}</p></div><div className="text-right text-sm tabular-nums"><p>{won(spent)} / {won(budget)}</p><p className="mt-1 text-[var(--tds-grey-500)]">남음 {won(budget - spent)}</p></div></li>;
      })}</ul>
    </section>}
  </div>;
}
