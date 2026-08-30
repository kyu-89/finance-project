'use client';

import { useState } from 'react';
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
  const [tab, setTab] = useState<'input' | 'all' | 'closing'>('input');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('input')}
          className={`min-h-12 px-4 text-[15px] font-semibold ${tab === 'input' ? 'border-b-2 border-[var(--tds-blue-500)] text-[var(--tds-grey-900)]' : 'text-[var(--tds-grey-500)]'}`}
        >
          월간입력
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`min-h-12 px-4 text-[15px] font-semibold ${tab === 'all' ? 'border-b-2 border-[var(--tds-blue-500)] text-[var(--tds-grey-900)]' : 'text-[var(--tds-grey-500)]'}`}
        >
          전체내역
        </button>
        <button
          type="button"
          onClick={() => setTab('closing')}
          className={`min-h-12 px-4 text-[15px] font-semibold ${tab === 'closing' ? 'border-b-2 border-[var(--tds-blue-500)] text-[var(--tds-grey-900)]' : 'text-[var(--tds-grey-500)]'}`}
        >
          예산·결산
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--tds-grey-100)] px-3 py-2 text-sm">
        <span className="mr-1 font-semibold text-[var(--tds-grey-700)]">월간 작업</span>
        <Link href="/settings/budgets" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">예산 설정</Link>
        <Link href="/settings/recurring" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">반복항목 관리</Link>
        <Link href="/monthly/month-end" className="rounded-lg bg-white px-3 py-2 font-semibold text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]">월말점검</Link>
      </div>
      {tab === 'input' ? (
        <MonthlyInputTab initialTransactions={transactions} categories={categories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} />
      ) : tab === 'all' ? (
        <AllTransactionsTab initialTransactions={transactions} supportDetails={supportDetails} eventDetails={eventDetails} members={members} categories={allCategories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} />
      ) : (
        <BudgetClosingTab transactions={transactions} categories={budgetCategories} budgets={budgets} />
      )}
    </div>
  );
}
