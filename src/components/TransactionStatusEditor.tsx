'use client';

import { useActionState } from 'react';
import { updateTransactionStatusAction } from '@/actions/transaction-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Transaction } from '@/lib/transactions';

export const TRANSACTION_STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '이번 달 제외',
  cancelled: '취소',
};

export function TransactionStatusEditor({ transaction }: { transaction: Transaction }) {
  const [state, formAction, pending] = useActionState(
    updateTransactionStatusAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex min-w-0 items-center gap-1">
      <input type="hidden" name="id" value={transaction.id} />
      <select
        name="status"
        defaultValue={transaction.status}
        aria-label={`${transaction.description} 상태`}
        disabled={pending}
        className="min-w-0 px-2 py-1 text-xs"
      >
        {Object.entries(TRANSACTION_STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="secondary-button min-h-9 w-[52px] shrink-0 whitespace-nowrap px-2 text-xs"
      >
        {pending ? '저장 중' : '변경'}
      </button>
      {state.ok === false && <span role="alert" className="sr-only">{state.message}</span>}
      {state.ok === true && <span role="status" className="sr-only">상태가 변경됐어요.</span>}
    </form>
  );
}
