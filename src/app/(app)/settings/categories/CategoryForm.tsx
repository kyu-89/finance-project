'use client';

import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { createCategoryAction } from '@/actions/category-actions';

export function CategoryForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <FormMessage result={state} />
      <label className="flex flex-col gap-1 text-sm">
        유형
        <select name="transactionType" className="rounded border px-2 py-1">
          <option value="expense">지출</option>
          <option value="income">수입</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        이름
        <input name="name" required className="rounded border px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        기본 비용성격
        <select name="defaultCostBehavior" className="rounded border px-2 py-1">
          <option value="">(해당 없음)</option>
          <option value="fixed">고정비</option>
          <option value="variable">변동비</option>
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
