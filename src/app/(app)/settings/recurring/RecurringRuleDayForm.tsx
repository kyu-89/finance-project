'use client';

import { useActionState } from 'react';
import { updateRecurringRuleDayAction } from '@/actions/recurring-rule-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';

export function RecurringRuleDayForm({ id, day, ended }: { id: string; day: number; ended: boolean }) {
  const [state, action, pending] = useActionState(updateRecurringRuleDayAction, INITIAL_ACTION_STATE);
  if (ended) return null;
  return <form action={action} className="mt-1 flex flex-wrap items-center gap-1">
    <input type="hidden" name="id" value={id} />
    <input name="dayOfMonth" type="number" min="1" max="31" defaultValue={day} required aria-label="다음 회차부터 적용할 월 납부일" className="w-20 px-2 py-1 text-xs" />
    <button type="submit" disabled={pending} className="secondary-button px-3 text-xs">다음 회차부터 납부일 변경</button>
    <FormMessage result={state} />
  </form>;
}
