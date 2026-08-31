'use client';

import { useActionState } from 'react';
import { updateRecurringRuleStatusAction } from '@/actions/recurring-rule-actions';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { RecurringRuleStatus } from '@/lib/recurring-rules';

export function RecurringRuleStatusButton({ id, status }: { id: string; status: RecurringRuleStatus }) {
  const [state, action, pending] = useActionState(updateRecurringRuleStatusAction, INITIAL_ACTION_STATE);
  const nextStatus = status === 'active' ? 'paused' : 'active';

  return <div className="flex flex-col items-end gap-1">
    {status !== 'ended' && <div className="flex gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={nextStatus} />
        <button type="submit" disabled={pending} className="secondary-button px-3">
          {status === 'active' ? '일시중지' : '재개'}
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="ended" />
        <ConfirmSubmitButton
          disabled={pending}
          className="min-h-11 px-3 text-sm font-semibold text-[var(--tds-red-500)]"
          title="반복 항목을 종료할까요?"
          description="종료한 반복 항목은 다시 예정 거래를 만들지 않습니다."
          confirmLabel="종료"
        >종료</ConfirmSubmitButton>
      </form>
    </div>}
    <FormMessage result={state} />
  </div>;
}
