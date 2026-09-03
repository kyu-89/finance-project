'use client';

import { startTransition, useActionState, useOptimistic } from 'react';
import { FormMessage } from '@/components/FormMessage';
import { InlineSaveFeedback } from '@/components/InlineSaveFeedback';
import { INITIAL_ACTION_STATE, type ActionResult } from '@/lib/action-result';

export type InlineActionSelectOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

type Props<Value extends string> = {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  id: string;
  label: string;
  name: string;
  value: Value;
  options: readonly InlineActionSelectOption<Value>[];
  hiddenFields?: Readonly<Record<string, string>>;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  feedback?: 'toast' | 'compact';
  successMessage?: string;
};

/**
 * A shared auto-submit select for compact resource rows and ledger cells.
 * The server action remains the source of validation; this component only
 * standardizes pending state, submission, and user feedback.
 *
 * 2026-09(사용자 지시, "한번에 제대로 고쳐라"): <select defaultValue>(비제어) → 직접 손으로 만든
 * "로컬 state + id/state 변경 감지" 낙관적 업데이트, 두 번 다 월간관리에서 상태를 바꾸면 잠시 뒤
 * 예전 값으로 되돌아가 보이는 버그가 재현됐다. 원인을 더 추측하는 대신, 정확히 이 용도로 만들어진
 * 리액트 19의 useOptimistic으로 바꿨다 — setOptimisticValue와 실제 서버 액션 호출을 같은
 * transition 안에서 실행하면, 리액트가 "이 낙관적 값은 이 대기 중인 액션에 속한다"를 직접
 * 추적한다. 액션이 끝나고 부모가 새 value를 내려주면 자동으로 그 값을 보여주고, 실패하거나
 * 부모 값이 그대로면 자동으로 원래 값으로 되돌아간다 — 되돌릴 "마지막 확정값"을 직접 기억하거나
 * id 변경을 손으로 감지할 필요가 아예 없어진다(리액트 내장 동작이라 더 신뢰할 수 있다).
 */
export function InlineActionSelect<Value extends string>({
  action,
  id,
  label,
  name,
  value,
  options,
  hiddenFields = {},
  disabled = false,
  className = '',
  selectClassName = 'tds-select',
  feedback = 'toast',
  successMessage = '저장했어요',
}: Props<Value>) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE);
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  const controlId = `inline-select-${name}-${id}`;

  return (
    <form className={`tds-inline-status-select ${className}`.trim()}>
      {Object.entries(hiddenFields).map(([fieldName, fieldValue]) => (
        <input key={fieldName} type="hidden" name={fieldName} value={fieldValue} />
      ))}
      <label className="sr-only" htmlFor={controlId}>{label}</label>
      <select
        id={controlId}
        name={name}
        value={optimisticValue}
        disabled={disabled || pending}
        aria-busy={pending}
        onChange={(event) => {
          const next = event.target.value as Value;
          const formData = new FormData(event.currentTarget.form!);
          formData.set(name, next);
          // setOptimisticValue와 formAction 호출이 같은 transition 안에 있어야 리액트가 이
          // 낙관적 값을 이 액션의 완료 시점(성공이든 실패든)에 맞춰 자동으로 정리해 준다.
          startTransition(() => {
            setOptimisticValue(next);
            formAction(formData);
          });
        }}
        className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
        ))}
      </select>
      {feedback === 'toast'
        ? <FormMessage result={state} successMessage={successMessage} />
        : <InlineSaveFeedback pending={pending} ok={state.ok} message={state.ok === false ? state.message : undefined} />}
    </form>
  );
}
