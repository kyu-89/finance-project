'use client';

import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { createPaymentMethodAction } from '@/actions/payment-method-actions';

export function PaymentMethodForm() {
  const [state, formAction, pending] = useActionState(createPaymentMethodAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <FormMessage result={state} />
      <label className="flex flex-col gap-1 text-sm">
        이름
        <input name="name" required className="rounded border px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        종류
        <select name="methodType" className="rounded border px-2 py-1">
          <option value="credit_card">신용카드</option>
          <option value="check_card">체크카드</option>
          <option value="account_transfer">계좌이체</option>
          <option value="cash">현금</option>
          <option value="other">기타</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
      >
        {pending ? '저장 중...' : '추가'}
      </button>
    </form>
  );
}
