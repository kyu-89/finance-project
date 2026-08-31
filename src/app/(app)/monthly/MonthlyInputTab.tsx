'use client';

import { useActionState, useMemo } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import {
  confirmPlannedTransactionAction,
  skipPlannedTransactionAction,
  linkRecurringOccurrenceAction,
  updateCostBehaviorAction,
} from '@/actions/transaction-actions';
import { AddDrawer } from '@/components/Drawer';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';
import { MonthlyDrawerForm as MonthlyRowForm } from './MonthlyDrawerForm';
import { TransactionStatusEditor } from '@/components/TransactionStatusEditor';

// No optional row models (sorting/filtering/etc.) are needed for this first-pass read-only
// table, so the feature registry is empty — the core row model is automatic in v9.
const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Transaction>();


function CostBehaviorEditor({ transaction }: { transaction: Transaction }) {
  const [state, formAction, pending] = useActionState(
    updateCostBehaviorAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="flex min-w-0 flex-col gap-1">
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
    {candidates.length > 0 && <p className="rounded-lg bg-[var(--tds-yellow-100)] px-2 py-1 text-xs font-semibold text-[var(--tds-yellow-700)]">비슷한 실제 거래가 {candidates.length}건 있어요. 확정 전에 확인해 주세요.</p>}
    <form action={confirmAction} className="flex items-center gap-1 whitespace-nowrap">
      <input type="hidden" name="id" value={transaction.id} />
      <input type="date" name="transactionDate" defaultValue={transaction.transactionDate} required className="w-32 shrink-0 px-2 py-1 text-xs" />
      <input type="number" name="amount" defaultValue={transaction.amount} min="1" step="1" required className="w-24 shrink-0 px-2 py-1 text-xs" />
      <select name="paymentMethodId" defaultValue={transaction.paymentMethodId ?? ''} className="w-24 min-w-0 px-2 py-1 text-xs">
        <option value="">결제수단 없음</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
      </select>
      <button type="submit" disabled={confirmPending} title="예정 거래를 실제 거래로 반영합니다." className="tds-primary-button min-h-11 px-3 text-xs">실제 반영</button>
    </form>
    <form action={skipAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="id" value={transaction.id} />
      <button type="submit" disabled={skipPending} title="이번 예정 거래만 이번 달 목록에서 제외합니다." className="min-h-11 px-3 text-xs font-semibold text-[var(--tds-red-500)]">이번 달 제외</button>
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
  columnHelper.accessor('status', { header: '상태', cell: (info) => <TransactionStatusEditor transaction={info.row.original} /> }),
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
  const orderedTransactions = useMemo(() => [...initialTransactions].sort((a, b) => {
    if (a.status === 'planned' && b.status !== 'planned') return -1;
    if (a.status !== 'planned' && b.status === 'planned') return 1;
    return a.transactionDate.localeCompare(b.transactionDate);
  }), [initialTransactions]);
  const plannedTransactions = orderedTransactions.filter((transaction) => transaction.status === 'planned');
  const table = useTable({ features, columns, data: orderedTransactions });

  return (
    <div className="monthly-input-panel flex flex-col gap-4">
      <div className="monthly-cta monthly-quick-actions"><AddDrawer title="수입 추가" description="이번 달에 들어온 돈을 기록하세요." triggerLabel="수입 추가"><MonthlyRowForm initialTransactionType="income" categories={categories} paymentMethods={paymentMethods} transactions={initialTransactions} /></AddDrawer><AddDrawer title="지출 추가" description="이번 달에 쓴 돈을 기록하세요." triggerLabel="지출 추가"><MonthlyRowForm initialTransactionType="expense" categories={categories} paymentMethods={paymentMethods} transactions={initialTransactions} /></AddDrawer><AddDrawer title="기타 거래 입력" description="저축·투자·환불·이체 등 기타 거래를 기록하세요." triggerLabel="기타 거래"><MonthlyRowForm categories={categories} paymentMethods={paymentMethods} transactions={initialTransactions} /></AddDrawer></div>
      <section className={`monthly-planned-queue ${plannedTransactions.length ? 'has-items' : 'is-clear'}`} aria-label="예정 거래 처리 현황"><div><span className="monthly-kicker">예정 거래 처리</span><strong>{plannedTransactions.length ? `${plannedTransactions.length}건이 처리 대기 중이에요` : '처리할 예정 거래가 없어요'}</strong></div><p>{plannedTransactions.length ? '표의 상단에서 금액을 확인한 뒤 확정하거나 이번 달 제외를 선택하세요.' : '반복항목이 생성되면 이 영역과 거래 목록 상단에 먼저 표시됩니다.'}</p></section>

      <div className="table-surface overflow-x-auto">
        <table className="monthly-input-table w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b text-left">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-3 py-3 align-middle ${columnAlignment(header.column.id, true)} whitespace-nowrap`}
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
