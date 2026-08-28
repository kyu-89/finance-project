'use client';

import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { deactivatePaymentMethodAction } from '@/actions/payment-method-actions';

export function DeactivatePaymentMethodButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deactivatePaymentMethodAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 px-3 text-sm font-semibold text-[var(--tds-red-500)] disabled:opacity-50"
      >
        비활성화
      </button>
      <FormMessage result={state} />
    </form>
  );
}
