'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MonthlyInputTab } from './MonthlyInputTab';
import { AllTransactionsTab } from './AllTransactionsTab';
import { BudgetClosingTab } from './BudgetClosingTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';
import type { Budget } from '@/lib/budgets';
import type { SupportDetail, EventDetail } from '@/lib/transaction-details';
import type { HouseholdMember } from '@/lib/household';

export function MonthlyPageTabs({ transactions, categories, paymentMethods, duplicateCandidates, budgets, budgetCategories, allCategories, supportDetails, eventDetails, members }: { transactions: Transaction[]; categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; duplicateCandidates: Record<string, DuplicateCandidate[]>; budgets: Budget[]; budgetCategories: CategoryWithSubcategories[]; allCategories: CategoryWithSubcategories[]; supportDetails: Record<string, SupportDetail>; eventDetails: Record<string, EventDetail>; members: HouseholdMember[] }) {
  const [activeView, setActiveView] = useState<'monthly' | 'all' | 'budget'>('monthly');
  return <div className="flex flex-col gap-4">
    <p className="monthly-view-hint">이번 달 거래를 먼저 처리하고, 필요한 내역과 예산을 같은 작업 영역에서 바로 확인하세요.</p>
    <div className="monthly-work-links flex flex-wrap items-center gap-2 rounded-xl bg-[var(--tds-grey-100)] px-3 py-2 text-sm"><span className="mr-1 font-semibold text-[var(--tds-grey-700)]">월간 작업</span><Link href="/settings/budgets" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">예산 설정</Link><Link href="/settings/recurring" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">반복항목 관리</Link><Link href="/monthly/month-end" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">월말점검</Link></div>
    <section className="monthly-workspace" aria-label="월간 재무 작업"><div className="monthly-workspace-tabs" role="tablist" aria-label="월간 작업 보기"><button type="button" role="tab" aria-selected={activeView === 'monthly'} data-selected={activeView === 'monthly'} onClick={() => setActiveView('monthly')}>이번 달 거래</button><button type="button" role="tab" aria-selected={activeView === 'all'} data-selected={activeView === 'all'} onClick={() => setActiveView('all')}>전체 거래</button><button type="button" role="tab" aria-selected={activeView === 'budget'} data-selected={activeView === 'budget'} onClick={() => setActiveView('budget')}>예산 확인</button></div><div className="monthly-workspace-content" role="tabpanel">{activeView === 'monthly' && <MonthlyInputTab initialTransactions={transactions} categories={categories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} />}{activeView === 'all' && <AllTransactionsTab initialTransactions={transactions} supportDetails={supportDetails} eventDetails={eventDetails} members={members} categories={allCategories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} />}{activeView === 'budget' && <BudgetClosingTab transactions={transactions} categories={budgetCategories} budgets={budgets} />}</div></section>
  </div>;
}
