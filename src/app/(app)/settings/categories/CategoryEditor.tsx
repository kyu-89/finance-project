'use client';

import { useActionState, useState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import {
  createSubcategoryAction,
  updateCategoryAction,
  updateSubcategoryAction,
  setSubcategoryActiveAction,
} from '@/actions/category-actions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import { StatusSelect } from '@/components/StatusSelect';

export function CategoryEditor({ category }: { category: CategoryWithSubcategories }) {
  const [expanded, setExpanded] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateCategoryAction, INITIAL_ACTION_STATE);
  const [subState, subAction, subPending] = useActionState(createSubcategoryAction, INITIAL_ACTION_STATE);
  const [subEditState, subEditAction, subEditPending] = useActionState(
    updateSubcategoryAction,
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
            <label className="form-field">
              이름
              <input
                name="name"
                defaultValue={category.name}
                required
                className="px-3 py-2"
                placeholder="카테고리 이름"
              />
            </label>
            <label className="form-field">
              기본 비용성격
              <select
                name="defaultCostBehavior"
                defaultValue={category.defaultCostBehavior ?? ''}
                className="tds-select px-3 py-2"
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
                <li key={sub.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {sub.isActive ? (
                    <form action={subEditAction} className="flex min-w-0 flex-1 items-center gap-2">
                      <input type="hidden" name="id" value={sub.id} />
                      <input
                        name="name"
                        defaultValue={sub.name}
                        aria-label={`${sub.name} 소분류 이름`}
                        required
                        className="min-w-0 flex-1 px-3 py-2 text-sm"
                        placeholder="소분류 이름"
                      />
                      <button
                        type="submit"
                        disabled={subEditPending}
                        className="secondary-button shrink-0 px-3"
                      >
                        저장
                      </button>
                    </form>
                  ) : (
                    <span className="min-h-11 flex-1 px-3 py-3 text-gray-400 line-through">
                      {sub.name}
                    </span>
                  )}
                  <StatusSelect id={sub.id} active={sub.isActive} action={setSubcategoryActiveAction} label={`${sub.name} 활성 상태`} />
                </li>
              ))}
            </ul>
            <FormMessage result={subEditState} />

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
