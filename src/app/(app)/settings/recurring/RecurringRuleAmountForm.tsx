'use client';

import { useActionState } from 'react';
import { updateRecurringRuleAmountAction } from '@/actions/recurring-rule-actions';
import { AmountInput } from '@/components/AmountInput';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';

export function RecurringRuleAmountForm({ id, amount, ended }: { id: string; amount: number; ended: boolean }) {
  const [state, action, pending] = useActionState(updateRecurringRuleAmountAction, INITIAL_ACTION_STATE);
  if (ended) return null;
  return <form action={action} className="mt-2 flex flex-wrap items-center gap-1">
    <input type="hidden" name="id" value={id} />
    <AmountInput name="amount" defaultValue={amount} required aria-label="이번 달부터 적용할 금액" className="w-32 px-2 py-1 text-xs" />
    <button type="submit" name="scope" value="once" disabled={pending} className="secondary-button px-3 text-xs">이번 달만 변경</button>
    <button type="submit" name="scope" value="future" disabled={pending} className="secondary-button px-3 text-xs">이번 달부터 변경</button>
    <FormMessage result={state} />
  </form>;
}
