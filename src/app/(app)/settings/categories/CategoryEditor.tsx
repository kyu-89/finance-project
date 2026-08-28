'use client';

import { useActionState, useState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import {
  createSubcategoryAction,
  deactivateSubcategoryAction,
  updateCategoryAction,
} from '@/actions/category-actions';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function CategoryEditor({ category }: { category: CategoryWithSubcategories }) {
  const [expanded, setExpanded] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateCategoryAction, INITIAL_ACTION_STATE);
  const [subState, subAction, subPending] = useActionState(createSubcategoryAction, INITIAL_ACTION_STATE);
  const [deactivateState, deactivateAction] = useActionState(
    deactivateSubcategoryAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <div className="tds-card p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="min-h-11 w-full text-left text-[15px] font-semibold"
      >
        {expanded ? '▾' : '▸'} [{category.transactionType === 'income' ? '수입' : '지출'}]{' '}
        {category.name}
        {category.defaultCostBehavior &&
          ` (${category.defaultCostBehavior === 'fixed' ? '고정비' : '변동비'})`}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-4">
          <form action={editAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <label className="flex flex-col gap-1 text-sm">
              이름
              <input
                name="name"
                defaultValue={category.name}
                required
                className="px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              기본 비용성격
              <select
                name="defaultCostBehavior"
                defaultValue={category.defaultCostBehavior ?? ''}
                className="px-3 py-2"
              >
                <option value="">(해당 없음)</option>
                <option value="fixed">고정비</option>
                <option value="variable">변동비</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={editPending}
              className="secondary-button px-4"
            >
              {editPending ? '저장 중...' : '수정'}
            </button>
          </form>
          <FormMessage result={editState} />
          <p className="text-xs text-gray-500">
            기본 비용성격을 바꿔도 이미 기록된 거래는 바뀌지 않아요.
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">소분류</span>
            <ul className="flex flex-col gap-1">
              {category.subcategories.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between text-sm">
                  <span className={sub.isActive ? '' : 'text-gray-400 line-through'}>{sub.name}</span>
                  {sub.isActive && (
                    <form action={deactivateAction}>
                      <input type="hidden" name="id" value={sub.id} />
                      <button
                        type="submit"
                        className="min-h-11 px-3 text-sm font-semibold text-[var(--tds-red-500)]"
                      >
                        비활성화
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <FormMessage result={deactivateState} />

            <form action={subAction} className="flex items-end gap-2">
              <input type="hidden" name="categoryId" value={category.id} />
              <input
                name="name"
                placeholder="새 소분류"
                required
                className="min-w-0 flex-1 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={subPending}
                className="secondary-button px-4"
              >
                {subPending ? '추가 중...' : '추가'}
              </button>
            </form>
            <FormMessage result={subState} />
          </div>
        </div>
      )}
    </div>
  );
}
