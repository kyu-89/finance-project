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
      <div className="flex flex-wrap gap-2">
        {(['all', 'planned', 'posted', 'skipped', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            data-selected={statusFilter === status}
            className="tds-chip px-4"
          >
            {status === 'all' ? '전체' : STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <div className="table-surface overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3">날짜</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">내용</th>
              <th className="px-4 py-3 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((transaction) => (
              <tr key={transaction.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{transaction.transactionDate}</td>
                <td className="px-4 py-3">{STATUS_LABEL[transaction.status]}</td>
                <td className="px-4 py-3">{transaction.description}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{transaction.amount.toLocaleString('ko-KR')}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tds-card flex flex-col items-end gap-1 p-4 text-sm">
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
