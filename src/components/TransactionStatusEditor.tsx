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
    <form action={formAction} className="transaction-status-editor flex min-w-0 items-center gap-1">
      <input type="hidden" name="id" value={transaction.id} />
      <select
        name="status"
        defaultValue={transaction.status}
        aria-label={`${transaction.description} 상태`}
        disabled={pending}
        aria-busy={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="min-w-0 px-2 py-1 text-xs"
      >
        {Object.entries(TRANSACTION_STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {pending && <span className="transaction-status-feedback" role="status">저장 중</span>}
      {state.ok === false && <span role="alert" className="transaction-status-feedback is-error">{state.message}</span>}
      {state.ok === true && <span role="status" className="transaction-status-feedback">저장됨</span>}
    </form>
  );
}
