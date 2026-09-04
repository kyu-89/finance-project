'use client';

import { useActionState, useState } from 'react';
import { budgetEditorAction } from '@/actions/budget-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { Budget } from '@/lib/budgets';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function AnnualBudgetEditor({ year, categories, budgets }: { year: number; categories: CategoryWithSubcategories[]; budgets: Budget[] }) {
  const [state, action, pending] = useActionState(budgetEditorAction, INITIAL_ACTION_STATE);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const amountByKey = new Map(budgets.map((budget) => [`${budget.transactionType}:${budget.categoryId}:${budget.month}`, budget.amount]));
  const expenseCategories = categories.filter((category) => category.transactionType === 'expense');
  const rows = [
    { categoryId: null, transactionType: 'income' as const, label: '총수입 계획' },
    { categoryId: null, transactionType: 'saving' as const, label: '저축 목표' },
    ...expenseCategories.map((category) => ({ categoryId: category.id, transactionType: 'expense' as const, label: category.name })),
  ];
  return <form action={action} onSubmit={(event) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'copy-previous' || submitter?.value === 'draft-actuals') {
      if (budgets.length > 0 && !window.confirm(`현재 ${year}년 예산 ${budgets.length}건이 있습니다. 기존 금액이 덮어써질 수 있습니다. 계속할까요?`)) event.preventDefault();
    }
  }} className="flex min-w-0 flex-col gap-4">
    <input type="hidden" name="year" value={year} />
    <FormMessage result={state} />
    <div className="flex flex-wrap gap-2">
      <button name="intent" value="copy-previous" type="submit" disabled={pending} className="secondary-button px-4">전년도 예산 복사</button>
      <button name="intent" value="draft-actuals" type="submit" disabled={pending} className="secondary-button px-4">전년도 실적 초안</button>
    </div>
    <div className="settings-month-switcher" role="tablist" aria-label="예산 입력 기간">
      <button type="button" role="tab" aria-selected={selectedMonth === null} className={selectedMonth === null ? 'is-selected' : ''} onClick={() => setSelectedMonth(null)}>전체</button>
      {Array.from({ length: 12 }, (_, index) => <button key={index} type="button" role="tab" aria-selected={selectedMonth === index + 1} className={selectedMonth === index + 1 ? 'is-selected' : ''} onClick={() => setSelectedMonth(index + 1)}>{index + 1}월</button>)}
    </div>
    <p className="text-xs text-[var(--tds-grey-600)]">{selectedMonth === null ? '전체 연간 계획을 한 번에 확인하고 입력합니다.' : `${selectedMonth}월 예산만 편집합니다. 다른 월의 기존 값은 유지됩니다.`}</p>
    <div className="annual-budget-scroll table-surface min-w-0 w-full max-w-full">
      <table className={`tds-data-table ${selectedMonth === null ? 'min-w-[1500px] text-sm' : 'min-w-[620px] text-sm'}`}><thead><tr><th className="sticky left-0 z-10 min-w-36 bg-white px-3 py-3 text-left">카테고리</th>
        {Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => selectedMonth === null || month === selectedMonth).map((month) => <th key={month} className="min-w-24 px-2 py-3 text-right">{month}월</th>)}
        <th className="min-w-28 px-3 py-3 text-right">연 합계</th><th className="min-w-28 px-3 py-3 text-right">월평균</th></tr></thead>
        <tbody>{rows.map(({ categoryId, transactionType, label }) => {
          const categoryToken = categoryId ?? '_total';
          const values = Array.from({ length: 12 }, (_, index) => amountByKey.get(`${transactionType}:${categoryId}:${index + 1}`) ?? 0);
          return <tr key={`${transactionType}:${categoryToken}`} className="border-t border-[var(--tds-grey-200)]">
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold">{label}</th>
            {values.map((amount, index) => selectedMonth === null || selectedMonth === index + 1 ? <td key={index} className="px-1 py-2"><WonInput name={`budget:${transactionType}:${categoryToken}:${index + 1}`} value={amount} ariaLabel={`${label} ${index + 1}월 예산`} /></td> : <td key={index} className="hidden"><input type="hidden" name={`budget:${transactionType}:${categoryToken}:${index + 1}`} value={amount} /></td>)}
            <td className="px-3 py-2 text-right font-semibold tabular-nums">{values.reduce((sum, amount) => sum + amount, 0).toLocaleString('ko-KR')}원</td>
            <td className="px-3 py-2 text-right tabular-nums">{Math.round(values.reduce((sum, amount) => sum + amount, 0) / 12).toLocaleString('ko-KR')}원</td>
          </tr>;
        })}</tbody></table>
    </div>
    <button name="intent" value="save" type="submit" disabled={pending} className="tds-primary-button self-end px-8">{pending ? '저장 중...' : `${year}년 예산 저장`}</button>
  </form>;
}

function WonInput({ name, value, ariaLabel }: { name: string; value: number; ariaLabel: string }) {
  const [display, setDisplay] = useState(value ? value.toLocaleString('ko-KR') : '');
  return <input name={name} type="text" inputMode="numeric" value={display}
    onChange={(event) => {
      const digits = event.target.value.replace(/\D/g, '');
      setDisplay(digits ? Number(digits).toLocaleString('ko-KR') : '');
    }} aria-label={ariaLabel} className="w-24 px-2 py-2 text-right text-xs tabular-nums" />;
}
