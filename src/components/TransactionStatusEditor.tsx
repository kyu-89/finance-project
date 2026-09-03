'use client';

import { useActionState } from 'react';
import { updateTransactionStatusAction } from '@/actions/transaction-actions';
import { addRecurringPausePeriodAction } from '@/actions/recurring-rule-actions';
import { Button } from '@/components/Button';
import { InlineActionSelect } from '@/components/InlineActionSelect';
import { InlineSaveFeedback } from '@/components/InlineSaveFeedback';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { monthRangeFromSeoulDateString } from '@/lib/date';
import type { Transaction } from '@/lib/transactions';

export const TRANSACTION_STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '이번 달 제외',
  cancelled: '취소',
  refunded: '환불',
};

const ALL_STATUS_OPTIONS = (Object.entries(TRANSACTION_STATUS_LABEL) as Array<[Transaction['status'], string]>)
  .map(([value, label]) => ({ value, label }));

// 취소/환불은 지출 거래에만 의미가 있다(사용자 지시: "취소와 환불 컬럼은 유형이 지출인 경우만에만
// 노출되도록") — 수입 거래에서는 이 두 옵션을 아예 목록에서 뺀다.
const EXPENSE_ONLY_STATUSES = new Set<Transaction['status']>(['cancelled', 'refunded']);
function statusOptionsFor(transactionType: Transaction['transactionType']) {
  return transactionType === 'expense'
    ? ALL_STATUS_OPTIONS
    : ALL_STATUS_OPTIONS.filter((option) => !EXPENSE_ONLY_STATUSES.has(option.value));
}

// planned 상태이면서 정기거래 규칙에서 생성된 행에 한해서만 [확정] [이번달 제외] 버튼 2개를
// 보여준다(§9). 그 외(취소 등 드문 상태, 또는 규칙 없이 수동으로 planned가 된 행)는 기존
// select 방식으로 폴백한다 — recurringRuleId가 없으면 이번달 제외에 필요한 rule id가 없다.
function PlannedRowActions({ transaction }: { transaction: Transaction & { recurringRuleId: string } }) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    updateTransactionStatusAction,
    INITIAL_ACTION_STATE,
  );
  const [skipState, skipAction, skipPending] = useActionState(
    addRecurringPausePeriodAction,
    INITIAL_ACTION_STATE,
  );
  const { fromDate, toDate } = monthRangeFromSeoulDateString(transaction.transactionDate);

  return (
    <div className="transaction-status-actions">
      <form action={confirmAction} className="transaction-inline-editor">
        <input type="hidden" name="id" value={transaction.id} />
        <input type="hidden" name="status" value="posted" />
        <Button
          type="submit"
          variant="primary"
          disabled={confirmPending}
          aria-busy={confirmPending}
          aria-label={`${transaction.description} 확정`}
        >
          확정
        </Button>
        <InlineSaveFeedback pending={confirmPending} ok={confirmState.ok} message={confirmState.ok === false ? confirmState.message : undefined} />
      </form>
      <form action={skipAction} className="transaction-inline-editor">
        <input type="hidden" name="id" value={transaction.recurringRuleId} />
        <input type="hidden" name="startDate" value={fromDate} />
        <input type="hidden" name="endDate" value={toDate} />
        <Button
          type="submit"
          variant="secondary"
          disabled={skipPending}
          aria-busy={skipPending}
          aria-label={`${transaction.description} 이번달 제외`}
        >
          이번달 제외
        </Button>
        <InlineSaveFeedback pending={skipPending} ok={skipState.ok} message={skipState.ok === false ? skipState.message : undefined} />
      </form>
    </div>
  );
}

export function TransactionStatusEditor({ transaction }: { transaction: Transaction }) {
  if (transaction.status === 'planned' && transaction.recurringRuleId) {
    return <PlannedRowActions transaction={{ ...transaction, recurringRuleId: transaction.recurringRuleId }} />;
  }

  return <InlineActionSelect
    action={updateTransactionStatusAction}
    id={transaction.id}
    label={`${transaction.description} 상태`}
    name="status"
    value={transaction.status}
    options={statusOptionsFor(transaction.transactionType)}
    hiddenFields={{ id: transaction.id }}
    className="transaction-status-editor transaction-inline-editor"
    selectClassName="tds-inline-select transaction-inline-select"
    feedback="compact"
  />;
}
