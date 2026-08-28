'use client';

import { useActionState } from 'react';
import { updateRecurringRuleStatusAction } from '@/actions/recurring-rule-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { RecurringRuleStatus } from '@/lib/recurring-rules';

export function RecurringRuleStatusButton({ id, status }: { id: string; status: RecurringRuleStatus }) {
  const [state, action, pending] = useActionState(updateRecurringRuleStatusAction, INITIAL_ACTION_STATE);
  const nextStatus = status === 'active' ? 'paused' : 'active';

  return <div className="flex flex-col items-end gap-1">
    {status !== 'ended' && <div className="flex gap-1"><form action={action}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={nextStatus} />
      <button type="submit" disabled={pending} className="secondary-button px-3">
        {status === 'active' ? '일시중지' : '재개'}
      </button>
    </form>
    <form action={action}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="ended" />
      <button type="submit" disabled={pending} className="min-h-11 px-3 text-sm font-semibold text-[var(--tds-red-500)]">종료</button>
    </form></div>}
    <FormMessage result={state} />
  </div>;
}
