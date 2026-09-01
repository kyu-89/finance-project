'use client';

import { useActionState } from 'react';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE, type ActionResult } from '@/lib/action-result';

export function StatusSelect({ id, active, action, label = '상태' }: {
  id: string;
  active: boolean;
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  return <form action={formAction} className="status-select flex min-w-28 flex-col items-stretch gap-1">
    <input type="hidden" name="id" value={id} />
    <label className="sr-only" htmlFor={`status-${id}`}>{label}</label>
    <select id={`status-${id}`} name="isActive" defaultValue={active ? 'true' : 'false'} disabled={pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="tds-select min-h-11 w-full px-3 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">
      <option value="true">활성</option><option value="false">비활성</option>
    </select>
    <FormMessage result={state} />
  </form>;
}
