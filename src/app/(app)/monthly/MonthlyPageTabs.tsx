'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MonthlyInputTab } from './MonthlyInputTab';
import { BudgetClosingTab } from './BudgetClosingTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { Budget } from '@/lib/budgets';

export function MonthlyPageTabs({ transactions, selectedMonth, categories, paymentMethods, budgets, budgetCategories }: { transactions: Transaction[]; selectedMonth: string; categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; budgets: Budget[]; budgetCategories: CategoryWithSubcategories[] }) {
  const [activeView, setActiveView] = useState<'monthly' | 'budget'>('monthly');
  const posted = transactions.filter((transaction) => transaction.status === 'posted');
  const income = posted.filter((transaction) => transaction.transactionType === 'income').reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = posted.filter((transaction) => transaction.transactionType === 'expense' && transaction.flowClass === 'consumption').reduce((sum, transaction) => sum + transaction.amount, 0);
  const wealth = posted.filter((transaction) => ['saving', 'investment', 'debt_principal'].includes(transaction.transactionType)).reduce((sum, transaction) => sum + transaction.amount, 0);
  const planned = transactions.filter((transaction) => transaction.status === 'planned').length;
  return <div className="flex flex-col gap-4">
    <section className="monthly-command-center" aria-label="이번 달 요약"><div className="monthly-command-copy"><p className="monthly-kicker">이번 달 흐름 보기</p><h2>이번 달의 자금 흐름을 정리해요</h2><p>선택한 연월의 확정 거래와 예정 거래를 구분해 보여드려요. 예정 거래를 먼저 처리하고 수입·지출을 추가해 보세요.</p></div><div className="monthly-summary-grid"><Summary label="들어온 돈" value={income} tone="income" /><Summary label="쓴 돈" value={expense} tone="expense" /><Summary label="자산형성" value={wealth} tone="wealth" /><Summary label="처리할 예정" value={planned} suffix="건" tone="planned" /></div></section>
    <div className="monthly-work-links flex flex-wrap items-center gap-2 rounded-xl bg-[var(--tds-grey-100)] px-3 py-2 text-sm"><span className="mr-1 font-semibold text-[var(--tds-grey-700)]">월간 작업</span><Link href="/settings/budgets" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">예산 설정</Link><Link href="/settings/recurring" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">반복 항목 관리</Link><Link href="/monthly/month-end" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">월말 점검</Link></div>
    <section className="monthly-workspace" aria-label="월간 관리 작업"><div className="monthly-workspace-tabs" role="tablist" aria-label="월간 관리 보기"><button type="button" role="tab" aria-selected={activeView === 'monthly'} data-selected={activeView === 'monthly'} onClick={() => setActiveView('monthly')}>거래 관리</button><button type="button" role="tab" aria-selected={activeView === 'budget'} data-selected={activeView === 'budget'} onClick={() => setActiveView('budget')}>예산 분석</button></div><div className="monthly-workspace-content" role="tabpanel">{activeView === 'monthly' && <MonthlyInputTab initialTransactions={transactions} selectedMonth={selectedMonth} categories={categories} paymentMethods={paymentMethods} />}{activeView === 'budget' && <BudgetClosingTab transactions={transactions} categories={budgetCategories} budgets={budgets} />}</div></section>
  </div>;
}

function Summary({ label, value, suffix = '원', tone }: { label: string; value: number; suffix?: string; tone: 'income' | 'expense' | 'wealth' | 'planned' }) { return <article className={`monthly-summary-card is-${tone}`}><span>{label}</span><strong>{value.toLocaleString('ko-KR')}{suffix}</strong></article>; }
