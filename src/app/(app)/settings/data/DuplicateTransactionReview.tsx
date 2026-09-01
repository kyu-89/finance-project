'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { reviewDuplicateTransactionAction } from '@/actions/transaction-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { DuplicateTransactionGroup, DuplicateTransactionRecord } from '@/lib/duplicate-transactions';

export function DuplicateTransactionReview({ groups }: { groups: DuplicateTransactionGroup[] }) {
  const duplicateCount = groups.reduce((sum, group) => sum + group.duplicates.length, 0);
  return <section className="tds-card p-5"><div><h2 className="text-lg font-bold">중복 거래 검토</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">같은 날짜·유형·금액·내용·결제수단으로 반복된 거래입니다. 원본은 유지되고, 확인한 행만 복구 가능한 삭제 처리됩니다.</p></div>{groups.length === 0 ? <p className="mt-5 text-sm text-[var(--tds-green-700)]">중복 후보가 없습니다.</p> : <><p className="mt-4 text-sm font-semibold">{groups.length}개 그룹 · 정리 대상 {duplicateCount}건</p><div className="mt-4 grid gap-3">{groups.map((group) => <DuplicateGroup key={group.key} group={group} />)}</div></>}</section>;
}

function DuplicateGroup({ group }: { group: DuplicateTransactionGroup }) {
  return <article className="rounded-xl border border-[var(--tds-grey-200)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{group.keeper.description}</p><p className="mt-1 text-xs text-[var(--tds-grey-600)]">{group.keeper.transactionDate} · {group.keeper.amount.toLocaleString('ko-KR')}원 · {group.keeper.transactionType}</p></div><span className="tds-chip">원본 1건 · 후보 {group.duplicates.length}건</span></div><div className="mt-3 grid gap-2">{[group.keeper, ...group.duplicates].map((transaction, index) => <CandidateRow key={transaction.id} transaction={transaction} keeperId={group.keeper.id} isKeeper={index === 0} />)}</div></article>;
}

function CandidateRow({ transaction, keeperId, isKeeper }: { transaction: DuplicateTransactionRecord; keeperId: string; isKeeper: boolean }) {
  const [state, action, pending] = useActionState(reviewDuplicateTransactionAction, INITIAL_ACTION_STATE);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [router, state.ok]);
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--tds-grey-50)] px-3 py-2 text-sm"><div className="min-w-0"><p className="truncate">{transaction.description}</p><p className="text-xs text-[var(--tds-grey-600)]">생성 {new Date(transaction.createdAt).toLocaleString('ko-KR')} · {transaction.status}</p></div>{isKeeper ? <span className="tds-chip">유지할 원본</span> : <form action={action} className="flex shrink-0 items-center gap-2"><input type="hidden" name="id" value={transaction.id} /><input type="hidden" name="keeperId" value={keeperId} /><button disabled={pending} className="tds-button-secondary min-h-11 px-3">{pending ? '처리 중…' : '중복 삭제'}</button><FormMessage result={state} /></form>}</div>;
}
