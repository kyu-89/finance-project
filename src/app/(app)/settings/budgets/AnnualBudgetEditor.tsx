'use client';

import { useActionState } from 'react';
import { budgetEditorAction } from '@/actions/budget-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { Budget } from '@/lib/budgets';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function AnnualBudgetEditor({ year, categories, budgets }: { year: number; categories: CategoryWithSubcategories[]; budgets: Budget[] }) {
  const [state, action, pending] = useActionState(budgetEditorAction, INITIAL_ACTION_STATE);
  const amountByKey = new Map(budgets.map((budget) => [`${budget.transactionType}:${budget.categoryId}:${budget.month}`, budget.amount]));
  const expenseCategories = categories.filter((category) => category.transactionType === 'expense');
  const rows = [
    { categoryId: null, transactionType: 'income' as const, label: '총수입 계획' },
    { categoryId: null, transactionType: 'saving' as const, label: '저축 목표' },
    ...expenseCategories.map((category) => ({ categoryId: category.id, transactionType: 'expense' as const, label: category.name })),
  ];
  return <form action={action} className="flex flex-col gap-4">
    <input type="hidden" name="year" value={year} />
    <FormMessage result={state} />
    <div className="flex flex-wrap gap-2">
      <button name="intent" value="copy-previous" type="submit" disabled={pending} className="secondary-button px-4">전년도 예산 복사</button>
      <button name="intent" value="draft-actuals" type="submit" disabled={pending} className="secondary-button px-4">전년도 실적 초안</button>
    </div>
    <div className="table-surface overflow-x-auto">
      <table className="min-w-[1500px] text-sm"><thead><tr><th className="sticky left-0 z-10 min-w-36 bg-white px-3 py-3 text-left">카테고리</th>
        {Array.from({ length: 12 }, (_, index) => <th key={index} className="min-w-24 px-2 py-3 text-right">{index + 1}월</th>)}
        <th className="min-w-28 px-3 py-3 text-right">연 합계</th></tr></thead>
        <tbody>{rows.map(({ categoryId, transactionType, label }) => {
          const categoryToken = categoryId ?? '_total';
          const values = Array.from({ length: 12 }, (_, index) => amountByKey.get(`${transactionType}:${categoryId}:${index + 1}`) ?? 0);
          return <tr key={`${transactionType}:${categoryToken}`} className="border-t border-[var(--tds-grey-200)]">
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold">{label}</th>
            {values.map((amount, index) => <td key={index} className="px-1 py-2"><input name={`budget:${transactionType}:${categoryToken}:${index + 1}`} type="number" min="0" step="1" defaultValue={amount || ''} aria-label={`${label} ${index + 1}월 예산`} className="w-24 px-2 py-2 text-right text-xs tabular-nums" /></td>)}
            <td className="px-3 py-2 text-right font-semibold tabular-nums">{values.reduce((sum, amount) => sum + amount, 0).toLocaleString('ko-KR')}원</td>
          </tr>;
        })}</tbody></table>
    </div>
    <button name="intent" value="save" type="submit" disabled={pending} className="tds-primary-button self-end px-8">{pending ? '저장 중...' : `${year}년 예산 저장`}</button>
  </form>;
}
