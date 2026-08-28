'use client';

import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { deactivateCategoryAction } from '@/actions/category-actions';

export function DeactivateCategoryButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deactivateCategoryAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm text-red-600 disabled:opacity-50">
        비활성화
      </button>
      <FormMessage result={state} />
    </form>
  );
}
