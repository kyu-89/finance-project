'use client';

import { useActionState } from 'react';
import { addRecurringPausePeriodAction } from '@/actions/recurring-rule-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { RecurringPause } from '@/lib/recurring-rules';

export function RecurringPauseForm({ id, ended, pauses }: { id: string; ended: boolean; pauses: RecurringPause[] }) {
  const [state, action, pending] = useActionState(addRecurringPausePeriodAction, INITIAL_ACTION_STATE);
  return <div className="mt-2">
    {pauses.map((pause) => <p key={pause.id} className="text-xs text-[var(--tds-grey-500)]">
      중지 {pause.startDate} ~ {pause.endDate}{pause.reason ? ` · ${pause.reason}` : ''}
    </p>)}
    {!ended && <form action={action} className="mt-1 flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input name="startDate" type="date" required aria-label="중지 시작일" className="px-2 py-1 text-xs" />
      <input name="endDate" type="date" required aria-label="중지 종료일" className="px-2 py-1 text-xs" />
      <input name="reason" placeholder="사유 (선택)" className="w-28 px-2 py-1 text-xs" />
      <button type="submit" disabled={pending} className="secondary-button px-3 text-xs">기간 중지</button>
      <FormMessage result={state} />
    </form>}
  </div>;
}
