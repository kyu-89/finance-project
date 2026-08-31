'use client';

import Link from 'next/link';
import { MonthlyInputTab } from './MonthlyInputTab';
import { AllTransactionsTab } from './AllTransactionsTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';
import type { Budget } from '@/lib/budgets';
import { BudgetClosingTab } from './BudgetClosingTab';
import type { SupportDetail, EventDetail } from '@/lib/transaction-details';
import type { HouseholdMember } from '@/lib/household';

export function MonthlyPageTabs({
  transactions,
  categories,
  paymentMethods,
  duplicateCandidates,
  budgets,
  budgetCategories,
  allCategories,
  supportDetails,
  eventDetails,
  members,
}: {
  transactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  duplicateCandidates: Record<string, DuplicateCandidate[]>;
  budgets: Budget[];
  budgetCategories: CategoryWithSubcategories[];
  allCategories: CategoryWithSubcategories[];
  supportDetails: Record<string, SupportDetail>;
  eventDetails: Record<string, EventDetail>;
  members: HouseholdMember[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="monthly-view-hint">이번 달 거래를 먼저 처리하고, 필요한 내역과 예산을 아래에서 바로 확인하세요.</p>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--tds-grey-100)] px-3 py-2 text-sm">
        <span className="mr-1 font-semibold text-[var(--tds-grey-700)]">월간 작업</span>
        <Link href="/settings/budgets" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">예산 설정</Link>
        <Link href="/settings/recurring" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">반복항목 관리</Link>
        <Link href="/monthly/month-end" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">월말점검</Link>
      </div>
      <details className="monthly-section" open>
        <summary>이번 달 거래 <span>예정 거래를 실제 반영하거나 이번 회차에서 제외해요.</span></summary>
        <div className="monthly-section-body"><MonthlyInputTab initialTransactions={transactions} categories={categories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} /></div>
      </details>
      <details className="monthly-section">
        <summary>전체 거래 <span>조건을 걸어 과거·현재 거래를 찾아요.</span></summary>
        <div className="monthly-section-body"><AllTransactionsTab initialTransactions={transactions} supportDetails={supportDetails} eventDetails={eventDetails} members={members} categories={allCategories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} /></div>
      </details>
      <details className="monthly-section">
        <summary>예산 확인 <span>이번 달 예산과 실제 지출을 비교해요.</span></summary>
        <div className="monthly-section-body"><BudgetClosingTab transactions={transactions} categories={budgetCategories} budgets={budgets} /></div>
      </details>
    </div>
  );
}
