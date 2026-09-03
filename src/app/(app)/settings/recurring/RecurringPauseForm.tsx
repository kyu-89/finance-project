'use client';

import { useActionState } from 'react';
import { addRecurringPausePeriodAction } from '@/actions/recurring-rule-actions';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { RecurringPause } from '@/lib/recurring-rules';

export function RecurringPauseForm({ id, ended, pauses }: { id: string; ended: boolean; pauses: RecurringPause[] }) {
  const [state, action, pending] = useActionState(addRecurringPausePeriodAction, INITIAL_ACTION_STATE);
  return <div className="recurring-rule-pauses">
    {pauses.length > 0 && <ul className="recurring-rule-pause-list">{pauses.map((pause) => <li key={pause.id}>중지 {pause.startDate} ~ {pause.endDate}{pause.reason ? ` · ${pause.reason}` : ''}</li>)}</ul>}
    {!ended && <details className="recurring-rule-quick-action">
      <summary>일시중지 기간 추가</summary>
      <form action={action} className="recurring-rule-quick-action-body">
        <input type="hidden" name="id" value={id} />
        <div className="recurring-rule-quick-action-grid">
          <FormField label="시작일" required><input name="startDate" type="date" required /></FormField>
          <FormField label="종료일" required><input name="endDate" type="date" required /></FormField>
          <FormField label="사유" className="recurring-rule-pause-reason"><input name="reason" placeholder="예: 휴직, 여행" /></FormField>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? '추가 중…' : '일시중지 추가'}</Button>
        <FormMessage result={state} />
      </form>
    </details>}
  </div>;
}
