'use client';

import { useActionState } from 'react';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { updateRecurringRuleStatusAction } from '@/actions/recurring-rule-actions';
import type { RecurringRuleStatus } from '@/lib/recurring-rules';

const LABEL: Record<RecurringRuleStatus, string> = {
  active: '사용 중',
  paused: '일시 중지',
  ended: '종료',
};

export function RecurringRuleStatusSelect({ id, status }: { id: string; status: RecurringRuleStatus }) {
  const [state, action, pending] = useActionState(updateRecurringRuleStatusAction, INITIAL_ACTION_STATE);

  return (
    <form action={action} className="flex min-w-32 flex-col items-stretch gap-1">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`recurring-status-${id}`}>반복 항목 상태</label>
      <select
        id={`recurring-status-${id}`}
        name="status"
        defaultValue={status}
        disabled={pending || status === 'ended'}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="tds-select min-h-11 w-full px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {(Object.keys(LABEL) as RecurringRuleStatus[]).map((value) => <option key={value} value={value}>{LABEL[value]}</option>)}
      </select>
      <FormMessage result={state} />
    </form>
  );
}
