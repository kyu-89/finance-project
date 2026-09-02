'use client';

import { useActionState } from 'react';
import { FormMessage } from '@/components/FormMessage';
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
        defaultValue={value}
        disabled={disabled || pending}
        aria-busy={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
        ))}
      </select>
      {feedback === 'toast' ? (
        <FormMessage result={state} successMessage={successMessage} />
      ) : (
        <>
          {pending && <span className="transaction-status-feedback" role="status">저장 중</span>}
          {state.ok === false && <span role="alert" className="transaction-status-feedback is-error">{state.message}</span>}
          {state.ok === true && !pending && <span role="status" className="transaction-status-feedback">저장됨</span>}
        </>
      )}
    </form>
  );
}
