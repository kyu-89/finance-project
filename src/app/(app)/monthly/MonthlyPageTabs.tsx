'use client';

import { useState } from 'react';
import { MonthlyInputTab } from './MonthlyInputTab';
import { AllTransactionsTab } from './AllTransactionsTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';

export function MonthlyPageTabs({
  transactions,
  categories,
  paymentMethods,
  duplicateCandidates,
}: {
  transactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  duplicateCandidates: Record<string, DuplicateCandidate[]>;
}) {
  const [tab, setTab] = useState<'input' | 'all'>('input');

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
      </div>
      {tab === 'input' ? (
        <MonthlyInputTab initialTransactions={transactions} categories={categories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} />
      ) : (
        <AllTransactionsTab initialTransactions={transactions} />
      )}
    </div>
  );
}
