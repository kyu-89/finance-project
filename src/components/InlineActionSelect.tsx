'use client';

import { useActionState, useState } from 'react';
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
 * 2026-09(사용자 지시): 이전엔 <select defaultValue>로 비제어 상태였다 — 저장에 성공한 직후
 * 부모가 아직 새로고침되지 않은 이전 값을 다시 내려보내는 순간이 있으면, 사용자가 방금 고른
 * 값이 화면에서 "확정" 같은 예전 값으로 되돌아가 보이는 버그가 있었다(월간관리 상태 select에서
 * 재현 확인). 이제 선택값을 로컬 state로 들고 있다가, id가 바뀔 때(다른 거래로 재사용될 때)만
 * 프롭에서 다시 동기화하고(렌더 중 상태 조정 패턴 — 리액트가 권장하는 방식, ref는 쓰지 않는다),
 * 저장 실패 시에는 마지막으로 서버가 확정한 값으로 롤백한다. 저장 성공/진행 중에는 부모가
 * 내려주는(아직 stale할 수 있는) value를 절대 덮어쓰지 않는다.
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
  const [selected, setSelected] = useState(value);
  const [confirmed, setConfirmed] = useState(value);
  const [trackedId, setTrackedId] = useState(id);
  const [prevState, setPrevState] = useState(state);

  // id가 바뀌면(이 컴포넌트가 다른 거래를 나타내게 되면) 그 시점의 프롭으로 다시 동기화한다.
  if (trackedId !== id) {
    setTrackedId(id);
    setSelected(value);
    setConfirmed(value);
  }

  // 저장 성공/실패가 새로 도착한 시점을 렌더 중에 감지해 즉시 반영한다(리액트가 권장하는
  // "렌더 중 상태 조정" 패턴 — effect 안에서 무조건 setState를 부르지 않기 위함).
  if (state !== prevState) {
    setPrevState(state);
    if (state.ok === true) setConfirmed(selected);
    else if (state.ok === false) setSelected(confirmed);
  }

  const controlId = `inline-select-${name}-${id}`;

  return (
    <form action={formAction} className={`tds-inline-status-select ${className}`.trim()}>
      {Object.entries(hiddenFields).map(([fieldName, fieldValue]) => (
        <input key={fieldName} type="hidden" name={fieldName} value={fieldValue} />
      ))}
      <label className="sr-only" htmlFor={controlId}>{label}</label>
      <select
        id={controlId}
        name={name}
        value={selected}
        disabled={disabled || pending}
        aria-busy={pending}
        onChange={(event) => {
          const next = event.target.value as Value;
          setSelected(next);
          event.currentTarget.form?.requestSubmit();
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
