'use client';

import { useActionState, useState } from 'react';
import { updateRecurringRuleScheduleAction } from '@/actions/recurring-rule-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { RecurrenceFrequency } from '@/lib/recurrence';

export function RecurringRuleScheduleForm({
  id, frequency: initialFrequency, intervalCount, day, ended,
}: {
  id: string; frequency: RecurrenceFrequency; intervalCount: number; day: number; ended: boolean;
}) {
  const [state, action, pending] = useActionState(updateRecurringRuleScheduleAction, INITIAL_ACTION_STATE);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(initialFrequency);
  if (ended) return null;
  return <form action={action} className="mt-1 flex flex-wrap items-center gap-1">
    <input type="hidden" name="id" value={id} />
    <input name="intervalCount" type="number" min="1" step="1" defaultValue={intervalCount} required aria-label="반복 간격" className="w-16 px-2 py-1 text-xs" />
    <select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)} className="w-20 px-2 py-1 text-xs" aria-label="반복 주기">
      <option value="monthly">개월</option><option value="weekly">주</option><option value="yearly">년</option><option value="custom">일</option>
    </select>
    {frequency === 'monthly' && <input name="dayOfMonth" type="number" min="1" max="31" defaultValue={day} required aria-label="월 납부일" className="w-20 px-2 py-1 text-xs" />}
    <button type="submit" disabled={pending} className="secondary-button px-3 text-xs">다음 회차부터 주기 변경</button>
    <FormMessage result={state} />
  </form>;
}
