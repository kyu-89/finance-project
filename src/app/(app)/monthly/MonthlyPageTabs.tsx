'use client';

import { useState } from 'react';
import { MonthlyInputTab } from './MonthlyInputTab';
import { AllTransactionsTab } from './AllTransactionsTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function MonthlyPageTabs({
  transactions,
  categories,
  paymentMethods,
}: {
  transactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const [tab, setTab] = useState<'input' | 'all'>('input');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('input')}
          className={`px-3 py-2 text-sm ${tab === 'input' ? 'border-b-2 border-black font-medium' : 'text-gray-500'}`}
        >
          월간입력
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-3 py-2 text-sm ${tab === 'all' ? 'border-b-2 border-black font-medium' : 'text-gray-500'}`}
        >
          전체내역
        </button>
      </div>
      {tab === 'input' ? (
        <MonthlyInputTab initialTransactions={transactions} categories={categories} paymentMethods={paymentMethods} />
      ) : (
        <AllTransactionsTab initialTransactions={transactions} />
      )}
    </div>
  );
}
