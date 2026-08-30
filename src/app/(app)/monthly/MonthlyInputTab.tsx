'use client';

import { useActionState, useMemo, useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import {
  createMonthlyRowAction,
  confirmPlannedTransactionAction,
  skipPlannedTransactionAction,
  linkRecurringOccurrenceAction,
  updateCostBehaviorAction,
} from '@/actions/transaction-actions';
import { FormMessage } from '@/components/FormMessage';
import { AddDrawer } from '@/components/Drawer';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';
import { MonthlyDrawerForm as MonthlyRowForm } from './MonthlyDrawerForm';

// No optional row models (sorting/filtering/etc.) are needed for this first-pass read-only
// table, so the feature registry is empty — the core row model is automatic in v9.
const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Transaction>();

const STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '건너뜀',
  cancelled: '취소',
};

function CostBehaviorEditor({ transaction }: { transaction: Transaction }) {
  const [state, formAction, pending] = useActionState(
    updateCostBehaviorAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex min-w-[220px] flex-col gap-1">
      <input type="hidden" name="id" value={transaction.id} />
      <div className="flex gap-1">
        <select
          name="costBehavior"
          defaultValue={transaction.costBehavior ?? ''}
          aria-label={`${transaction.description} 비용성격`}
          className="min-w-0 flex-1 px-2 py-1 text-xs"
        >
          <option value="">미지정</option>
          <option value="fixed">고정비</option>
          <option value="variable">변동비</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="secondary-button w-[76px] shrink-0 whitespace-nowrap px-2 text-xs"
        >
          {pending ? '저장 중…' : '변경'}
        </button>
      </div>
      {state.ok === false && (
        <span role="alert" className="text-xs text-red-600">
          {state.message}
        </span>
      )}
      {state.ok === true && (
        <span role="status" className="text-xs text-green-700">
          저장됨
        </span>
      )}
    </form>
  );
}

function PlannedTransactionEditor({ transaction, paymentMethods, candidates }: { transaction: Transaction; paymentMethods: PaymentMethod[]; candidates: DuplicateCandidate[] }) {
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmPlannedTransactionAction, INITIAL_ACTION_STATE);
  const [skipState, skipAction, skipPending] = useActionState(skipPlannedTransactionAction, INITIAL_ACTION_STATE);
  const [linkState, linkAction, linkPending] = useActionState(linkRecurringOccurrenceAction, INITIAL_ACTION_STATE);
  if (transaction.status !== 'planned') return <span className="text-xs text-[var(--tds-grey-500)]">처리 완료</span>;

  return <div className="flex min-w-0 flex-col gap-1">
    <form action={confirmAction} className="flex items-center gap-1 whitespace-nowrap">
      <input type="hidden" name="id" value={transaction.id} />
      <input type="date" name="transactionDate" defaultValue={transaction.transactionDate} required className="w-32 shrink-0 px-2 py-1 text-xs" />
      <input type="number" name="amount" defaultValue={transaction.amount} min="1" step="1" required className="w-24 shrink-0 px-2 py-1 text-xs" />
      <select name="paymentMethodId" defaultValue={transaction.paymentMethodId ?? ''} className="w-24 min-w-0 px-2 py-1 text-xs">
        <option value="">결제수단 없음</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
      </select>
      <button type="submit" disabled={confirmPending} className="tds-primary-button min-h-11 px-3 text-xs">확정</button>
    </form>
    <form action={skipAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="id" value={transaction.id} />
      <button type="submit" disabled={skipPending} className="min-h-11 px-3 text-xs font-semibold text-[var(--tds-red-500)]">이번 회차 건너뛰기</button>
    </form>
    {candidates.length > 0 && transaction.recurringOccurrenceId && <form action={linkAction} className="flex items-center gap-1 rounded-xl bg-[var(--tds-blue-50)] p-2">
      <input type="hidden" name="occurrenceId" value={transaction.recurringOccurrenceId} />
      <input type="hidden" name="plannedTransactionId" value={transaction.id} />
      <select name="postedTransactionId" className="min-w-0 flex-1 px-2 py-1 text-xs" aria-label="중복 후보 거래">
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.transactionDate} · {candidate.description}</option>)}
      </select>
      <button type="submit" disabled={linkPending} className="secondary-button px-3 text-xs">기존 거래와 연결</button>
    </form>}
    <FormMessage result={confirmState} /><FormMessage result={skipState} /><FormMessage result={linkState} />
  </div>;
}

function makeColumns(paymentMethods: PaymentMethod[], duplicateCandidates: Record<string, DuplicateCandidate[]>) {
  return columnHelper.columns([
  columnHelper.accessor('transactionDate', { header: '날짜' }),
  columnHelper.accessor('status', { header: '상태', cell: (info) => <span className="tds-chip">{STATUS_LABEL[info.getValue()]}</span> }),
  columnHelper.accessor('description', { header: '내용' }),
  columnHelper.accessor('amount', {
    header: '금액',
    cell: (info) => `${info.getValue().toLocaleString('ko-KR')}원`,
  }),
  columnHelper.accessor('costBehavior', {
    header: '비용성격',
    cell: (info) => <CostBehaviorEditor transaction={info.row.original} />,
  }),
  columnHelper.display({
    id: 'plannedAction',
    header: '예정 거래 처리',
    cell: (info) => <PlannedTransactionEditor transaction={info.row.original} paymentMethods={paymentMethods} candidates={duplicateCandidates[info.row.original.id] ?? []} />,
  }),
  ]);
}

function columnAlignment(columnId: string, header = false) {
  if (columnId === 'amount') return 'text-right';
  if (columnId === 'transactionDate' || columnId === 'status') return 'text-center';
  return header ? 'text-left' : 'text-left';
}

export function MonthlyInputTab({
  initialTransactions,
  categories,
  paymentMethods,
  duplicateCandidates,
}: {
  initialTransactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  duplicateCandidates: Record<string, DuplicateCandidate[]>;
}) {
  const columns = useMemo(() => makeColumns(paymentMethods, duplicateCandidates), [paymentMethods, duplicateCandidates]);
  const table = useTable({ features, columns, data: initialTransactions });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><AddDrawer title="지출 입력" description="이번 달 거래를 추가하세요. 저장하면 목록에 바로 반영됩니다." triggerLabel="지출 추가"><MonthlyRowForm categories={categories} paymentMethods={paymentMethods} /></AddDrawer></div>

      <div className="table-surface overflow-x-auto">
        <table className="monthly-input-table w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b text-left">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3.5 align-middle ${columnAlignment(header.column.id, true)} whitespace-nowrap`}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="monthly-input-row border-b last:border-b-0">
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-3 align-middle ${columnAlignment(cell.column.id)} ${cell.column.id === 'transactionDate' ? 'whitespace-nowrap' : ''} ${cell.column.id === 'amount' ? 'font-semibold tabular-nums' : ''}`}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LegacyMonthlyRowForm({ categories, paymentMethods }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[] }) {
  const [categoryId, setCategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'saving' | 'investment' | 'debt_principal' | 'finance_cost' | 'transfer'>('expense');
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const [state, formAction, pending] = useActionState(createMonthlyRowAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="tds-card grid grid-cols-2 gap-3 p-5 md:grid-cols-7">
      <div className="col-span-2 md:col-span-7"><FormMessage result={state} /></div>
      <label className="col-span-2 flex flex-col gap-1 text-sm font-medium md:col-span-1"><span>거래 유형</span><select value={transactionType} onChange={(e) => { const next = e.target.value as typeof transactionType; setTransactionType(next); setCategoryId(''); }} className="rounded border px-2 py-1 text-sm"><option value="expense">지출</option><option value="income">수입</option><option value="saving">저축</option><option value="investment">투자</option><option value="debt_principal">대출 원금상환</option><option value="finance_cost">금융비용</option><option value="transfer">이체</option></select></label>
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="categoryDefaultCostBehavior" value={selectedCategory?.defaultCostBehavior ?? ''} />
      <input type="date" name="transactionDate" required className="rounded border px-2 py-1 text-sm" />
      {(transactionType === 'income' || transactionType === 'expense') && <select name="categoryId" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border px-2 py-1 text-sm">
        <option value="">대분류</option>
        {categories.filter((c) => c.transactionType === transactionType && c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>}
      {(transactionType === 'income' || transactionType === 'expense') && <select name="subcategoryId" className="rounded border px-2 py-1 text-sm">
        <option value="">소분류</option>
        {selectedCategory?.subcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
      </select>}
      {transactionType === 'expense' && <select name="paymentMethodId" required className="rounded border px-2 py-1 text-sm">
        <option value="">결제수단</option>
        {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
      </select>}
      {transactionType === 'expense' && <select name="costBehaviorOverride" className="rounded border px-2 py-1 text-sm">
        <option value="">기본 비용성격</option><option value="fixed">고정비</option><option value="variable">변동비</option>
      </select>}
      <input name="description" placeholder="내용" required className="rounded border px-2 py-1 text-sm" />
      <input name="amount" type="number" step="1" min="1" placeholder="금액" required className="rounded border px-2 py-1 text-sm" />
      <button type="submit" disabled={pending} className="monthly-add-button tds-primary-button col-span-2 px-4 text-[0px] md:col-span-1">
        <span className="text-[15px]">{pending ? '추가 중…' : `${transactionType === 'expense' ? '지출' : transactionType === 'income' ? '수입' : '거래'} 추가`}</span>
      </button>
    </form>
  );
}
