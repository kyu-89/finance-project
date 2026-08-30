'use client';

import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { deactivatePaymentMethodAction } from '@/actions/payment-method-actions';

export function DeactivatePaymentMethodButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deactivatePaymentMethodAction, INITIAL_ACTION_STATE);
  return <form action={formAction} className="flex flex-col items-end gap-1">
    <input type="hidden" name="id" value={id} />
    <button type="submit" disabled={pending} className="rounded-xl border border-[var(--tds-red-500)]/30 px-3 py-2 text-sm font-semibold text-[var(--tds-red-500)] transition hover:bg-[oklch(0.96_0.025_22)] active:scale-[.98] disabled:opacity-50">
      {pending ? '처리 중…' : '사용 안 함'}
    </button>
    <FormMessage result={state} successMessage="결제수단을 사용하지 않도록 바꿨어요." />
  </form>;
}
