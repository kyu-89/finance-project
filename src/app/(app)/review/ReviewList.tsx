'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmReviewedTransactionAction, deleteTransactionAction } from '@/actions/transaction-actions';
import { FormMessage } from '@/components/FormMessage';
import { Button } from '@/components/Button';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import { TransactionDetailDrawer } from '@/app/(app)/monthly/TransactionDetailDrawer';

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<Transaction['transactionType'], string> = {
  income: '수입',
  expense: '지출',
};

export function ReviewList({ transactions, categories, paymentMethods }: { transactions: Transaction[]; categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[] }) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const subcategoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) for (const sub of category.subcategories) map.set(sub.id, sub.name);
    return map;
  }, [categories]);
  const paymentMethodNameById = useMemo(() => new Map(paymentMethods.map((p) => [p.id, p.name])), [paymentMethods]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return transactions;
    return transactions.filter((t) => t.description.toLowerCase().includes(normalized) || (t.memo ?? '').toLowerCase().includes(normalized));
  }, [query, transactions]);
  const visible = filtered.slice(0, visibleCount);

  if (transactions.length === 0) {
    return (
      <section className="tds-card p-8 text-center">
        <p className="text-lg font-bold text-[var(--tds-green-700)]">모두 검토 완료되었습니다 🎉</p>
        <p className="mt-2 text-sm text-[var(--tds-grey-600)]">더 이상 검토가 필요한 거래가 없어요. 이 화면은 설정 메뉴에서도 더 이상 보이지 않습니다.</p>
      </section>
    );
  }

  return (
    <section className="tds-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">검토 필요 {transactions.length}건</p>
        <span className="tds-chip shrink-0">전체 처리하면 화면이 사라져요</span>
      </div>
      <label className="form-field mt-4" htmlFor="review-search">
        <span>내용/메모 검색</span>
        <input id="review-search" value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="내용 또는 사유로 검색" type="search" />
      </label>
      {visible.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--tds-grey-500)]">검색 결과가 없습니다.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {visible.map((transaction) => (
            <ReviewRow
              key={transaction.id}
              transaction={transaction}
              categoryName={transaction.categoryId ? categoryNameById.get(transaction.categoryId) ?? null : null}
              subcategoryName={transaction.subcategoryId ? subcategoryNameById.get(transaction.subcategoryId) ?? null : null}
              paymentMethodName={transaction.paymentMethodId ? paymentMethodNameById.get(transaction.paymentMethodId) ?? null : null}
              onEdit={() => setEditing(transaction)}
            />
          ))}
        </div>
      )}
      {visibleCount < filtered.length && (
        <button type="button" className="tds-button-secondary mt-4 w-full" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
          더 보기 ({filtered.length - visibleCount}건 남음)
        </button>
      )}
      {editing && (
        <TransactionDetailDrawer
          key={editing.id}
          transaction={editing}
          categories={categories}
          paymentMethods={paymentMethods}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function ReviewRow({ transaction, categoryName, subcategoryName, paymentMethodName, onEdit }: {
  transaction: Transaction;
  categoryName: string | null;
  subcategoryName: string | null;
  paymentMethodName: string | null;
  onEdit: () => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmReviewedTransactionAction, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTransactionAction, INITIAL_ACTION_STATE);
  const router = useRouter();
  useEffect(() => { if (confirmState.ok || deleteState.ok) router.refresh(); }, [router, confirmState.ok, deleteState.ok]);

  return (
    <article className="rounded-xl border border-[var(--tds-grey-200)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{transaction.description}</p>
          <p className="mt-1 text-xs text-[var(--tds-grey-600)]">
            {transaction.transactionDate} · {TYPE_LABEL[transaction.transactionType]} · {transaction.amount.toLocaleString('ko-KR')}원
          </p>
          <p className="mt-1 text-xs text-[var(--tds-grey-600)]">
            {categoryName ?? <span className="text-[var(--tds-red-600)]">카테고리 미지정</span>}
            {subcategoryName ? ` / ${subcategoryName}` : ''}
            {' · '}
            {paymentMethodName ?? <span className="text-[var(--tds-red-600)]">결제수단 미지정</span>}
          </p>
        </div>
        <span className="tds-chip shrink-0">검토 필요</span>
      </div>
      {transaction.memo && (
        <p className="mt-3 rounded-lg bg-[var(--tds-yellow-50)] p-2 text-xs text-[var(--tds-grey-700)]">
          {transaction.memo}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={onEdit} className="px-3">수정</Button>
        <form action={confirmAction}><input type="hidden" name="id" value={transaction.id} /><Button type="submit" variant="primary" disabled={confirmPending} className="px-3">{confirmPending ? '처리 중…' : '확정'}</Button></form>
        <form action={deleteAction}><input type="hidden" name="id" value={transaction.id} /><Button type="submit" variant="danger" disabled={deletePending} className="px-3">{deletePending ? '삭제 중…' : '삭제'}</Button></form>
        <FormMessage result={confirmState} />
        <FormMessage result={deleteState} />
      </div>
    </article>
  );
}
