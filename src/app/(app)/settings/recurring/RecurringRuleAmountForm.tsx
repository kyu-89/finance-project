'use client';

import { useActionState } from 'react';
import { updateRecurringRuleAmountAction } from '@/actions/recurring-rule-actions';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';

// 2026-09: "이후 회차부터" 금액을 바꾸는 건 이제 반복 항목 수정 드로워(RecurringRuleForm)가
// 맡는다 — 여기 남은 건 규칙 자체는 그대로 두고 이번 달 예정 거래 1건만 예외로 바꾸는 좁은
// 기능뿐이다. 자주 쓰는 기능이 아니라 <details>로 접어 카드 기본 화면을 깔끔하게 유지한다.
export function RecurringRuleAmountForm({ id, amount, ended }: { id: string; amount: number; ended: boolean }) {
  const [state, action, pending] = useActionState(updateRecurringRuleAmountAction, INITIAL_ACTION_STATE);
  if (ended) return null;
  return <details className="recurring-rule-quick-action">
    <summary>이번 달만 금액 변경</summary>
    <form action={action} className="recurring-rule-quick-action-body">
      <input type="hidden" name="id" value={id} />
      <FormField label="이번 달 예정 거래에만 적용할 금액">
        <div className="recurring-rule-quick-action-row">
          <AmountInput name="amount" defaultValue={amount} required />
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? '변경 중…' : '변경'}</Button>
        </div>
      </FormField>
      <FormMessage result={state} />
    </form>
  </details>;
}
