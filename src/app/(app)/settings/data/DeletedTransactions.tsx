'use client';
import { useActionState } from 'react';
import { restoreTransactionAction } from '@/actions/transaction-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { DeletedTransaction } from '@/lib/transactions';

export function DeletedTransactions({ transactions }: { transactions: DeletedTransaction[] }) {
  return <section className="tds-card p-5"><div><h2 className="text-lg font-bold">최근 삭제한 거래</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">삭제 후 30일 이내 거래를 복구할 수 있어요.</p></div>{transactions.length === 0 ? <p className="mt-5 text-sm text-[var(--tds-grey-500)]">최근 삭제한 거래가 없습니다.</p> : <div className="mt-5 grid gap-2">{transactions.map((transaction) => <DeletedRow key={transaction.id} transaction={transaction} />)}</div>}</section>;
}

function DeletedRow({ transaction }: { transaction: DeletedTransaction }) {
  const [state, action, pending] = useActionState(restoreTransactionAction, INITIAL_ACTION_STATE);
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--tds-grey-100)] p-3"><div className="min-w-0"><p className="font-semibold">{transaction.description}</p><p className="text-xs text-[var(--tds-grey-500)]">{transaction.transactionDate} · {transaction.amount.toLocaleString('ko-KR')}원</p></div><form action={action} className="flex items-center gap-2"><input type="hidden" name="id" value={transaction.id} /><button disabled={pending} className="secondary-button px-3">{pending ? '복구 중…' : '복구'}</button><FormMessage result={state} /></form></div>;
}
