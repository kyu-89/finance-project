'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/transactions';
import { calculateTransactionTotals } from '@/lib/transaction-totals';

const STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '건너뜀',
  cancelled: '취소',
};

export function AllTransactionsTab({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [statusFilter, setStatusFilter] = useState<Transaction['status'] | 'all'>('all');

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? initialTransactions
        : initialTransactions.filter((t) => t.status === statusFilter),
    [initialTransactions, statusFilter],
  );

  const { consumptionTotal, plannedTotal } = calculateTransactionTotals(filtered);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['all', 'planned', 'posted', 'skipped', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded border px-2 py-1 text-sm ${statusFilter === status ? 'bg-black text-white' : ''}`}
          >
            {status === 'all' ? '전체' : STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">날짜</th>
              <th className="p-2">상태</th>
              <th className="p-2">내용</th>
              <th className="p-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((transaction) => (
              <tr key={transaction.id} className="border-b">
                <td className="p-2">{transaction.transactionDate}</td>
                <td className="p-2">{STATUS_LABEL[transaction.status]}</td>
                <td className="p-2">{transaction.description}</td>
                <td className="p-2 text-right">{transaction.amount.toLocaleString('ko-KR')}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1 text-sm">
        <p className="font-medium">
          소비 합계 (확정): {consumptionTotal.toLocaleString('ko-KR')}원
        </p>
        {plannedTotal > 0 && (
          <p className="text-gray-500">
            예정 (실적 미포함): {plannedTotal.toLocaleString('ko-KR')}원
          </p>
        )}
      </div>
    </div>
  );
}
