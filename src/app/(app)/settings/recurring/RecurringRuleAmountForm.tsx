'use client';

import { useActionState } from 'react';
import { updateRecurringRuleAmountAction } from '@/actions/recurring-rule-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';

export function RecurringRuleAmountForm({ id, amount, ended }: { id: string; amount: number; ended: boolean }) {
  const [state, action, pending] = useActionState(updateRecurringRuleAmountAction, INITIAL_ACTION_STATE);
  if (ended) return null;
  return <form action={action} className="mt-2 flex flex-wrap items-center gap-1">
    <input type="hidden" name="id" value={id} />
    <input name="amount" type="number" min="1" step="1" defaultValue={amount} required aria-label="이번 달부터 적용할 금액" className="w-32 px-2 py-1 text-xs" />
    <button type="submit" disabled={pending} className="secondary-button px-3 text-xs">이번 달부터 변경</button>
    <FormMessage result={state} />
  </form>;
}
