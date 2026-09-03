'use client';

import { useActionState } from 'react';
import { updateRecurringRuleAmountAction } from '@/actions/recurring-rule-actions';
import { AmountInput } from '@/components/AmountInput';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';

// 2026-09: "이후 회차부터" 금액을 바꾸는 건 이제 반복 항목 수정 드로워(RecurringRuleForm)가
// 맡는다 — 여기 남은 건 규칙 자체는 그대로 두고 이번 달 예정 거래 1건만 예외로 바꾸는 좁은
// 기능뿐이라 옵션 없이 버튼 하나면 된다.
export function RecurringRuleAmountForm({ id, amount, ended }: { id: string; amount: number; ended: boolean }) {
  const [state, action, pending] = useActionState(updateRecurringRuleAmountAction, INITIAL_ACTION_STATE);
  if (ended) return null;
  return <form action={action} className="mt-2 flex flex-wrap items-center gap-1">
    <input type="hidden" name="id" value={id} />
    <AmountInput name="amount" defaultValue={amount} required aria-label="이번 달만 적용할 금액" className="w-32 px-2 py-1 text-xs" />
    <button type="submit" disabled={pending} className="secondary-button px-3 text-xs">이번 달만 변경</button>
    <FormMessage result={state} />
  </form>;
}
