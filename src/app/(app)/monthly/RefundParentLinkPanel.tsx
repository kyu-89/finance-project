'use client';

import { useActionState } from 'react';
import { linkRefundParentAction } from '@/actions/refund-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Transaction } from '@/lib/transactions';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';

export function RefundParentLinkPanel({ transaction, transactions, onClose }: { transaction: Transaction; transactions: Transaction[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(linkRefundParentAction, INITIAL_ACTION_STATE);
  const candidates = transactions.filter((item) => item.id !== transaction.id && item.transactionType === 'expense' && item.flowClass === 'consumption' && item.status === 'posted');
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-3 sm:items-center" role="presentation"><section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="refund-parent-title"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--tds-blue-600)]">환불 검토</p><h2 id="refund-parent-title" className="mt-1 text-lg font-bold">원거래 연결</h2><p className="mt-1 text-sm text-[var(--tds-grey-600)]">{transaction.amount.toLocaleString('ko-KR')}원 환불의 원래 지출을 선택하세요.</p></div><button type="button" className="secondary-button px-3" onClick={onClose}>닫기</button></div><form action={action} className="mt-5 grid gap-3"><input type="hidden" name="transactionId" value={transaction.id} /><FormField label="원거래" required><select name="parentTransactionId" required className="px-3"><option value="">지출을 선택하세요</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.transactionDate} · {item.description} · {item.amount.toLocaleString('ko-KR')}원</option>)}</select></FormField><button type="submit" disabled={pending || candidates.length === 0} className="tds-primary-button">{pending ? '연결 중…' : '원거래 연결'}</button><FormMessage result={state} /></form></section></div>;
}
