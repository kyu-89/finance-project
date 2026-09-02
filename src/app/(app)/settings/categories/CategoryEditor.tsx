'use client';

import { useActionState, useState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import {
  createSubcategoryAction,
  setCategoryActiveAction,
  setSubcategoryActiveAction,
  updateCategoryAction,
  updateSubcategoryAction,
} from '@/actions/category-actions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import { StatusSelect } from '@/components/StatusSelect';

export function CategoryEditor({ category }: { category: CategoryWithSubcategories }) {
  const [expanded, setExpanded] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateCategoryAction, INITIAL_ACTION_STATE);
  const [subState, subAction, subPending] = useActionState(createSubcategoryAction, INITIAL_ACTION_STATE);
  const [subEditState, subEditAction, subEditPending] = useActionState(updateSubcategoryAction, INITIAL_ACTION_STATE);
  const typeLabel = category.transactionType === 'income' ? '수입' : '지출';

  return (
    <article className="tds-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-[var(--tds-grey-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--tds-blue-500)]"
      >
        <span className="min-w-0 flex items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-[var(--tds-blue-600)]">{typeLabel}</span>
          <span className="truncate text-[15px] font-semibold">{category.name}</span>
          {category.defaultCostBehavior && <span className="hidden shrink-0 text-xs text-[var(--tds-grey-500)] sm:inline">{category.defaultCostBehavior === 'fixed' ? '고정비' : '변동비'}</span>}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${category.isActive ? 'bg-[var(--tds-blue-50)] text-[var(--tds-blue-600)]' : 'bg-[var(--tds-grey-100)] text-[var(--tds-grey-600)]'}`}>{category.isActive ? '활성' : '비활성'}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-[var(--tds-grey-600)]">{expanded ? '접기' : '상세'}</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--tds-grey-200)] p-4">
          <div className="flex flex-col gap-4">
            <form action={editAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.55fr)_auto] sm:items-end">
              <input type="hidden" name="id" value={category.id} />
              <FormField label="이름" required><input name="name" defaultValue={category.name} required className="px-3 py-2" placeholder="카테고리 이름" /></FormField>
              <FormField label="기본 비용 성격"><select name="defaultCostBehavior" defaultValue={category.defaultCostBehavior ?? ''} className="tds-select px-3 py-2"><option value="">해당 없음</option><option value="fixed">고정비</option><option value="variable">변동비</option></select></FormField>
              <button type="submit" disabled={editPending} className="secondary-button px-4">{editPending ? '저장 중…' : '저장'}</button>
            </form>
            <FormMessage result={editState} />

            <section className="border-t border-[var(--tds-grey-200)] pt-4">
              <p className="text-sm font-semibold">카테고리 사용 상태</p>
              <p className="mt-1 text-xs text-[var(--tds-grey-600)]">비활성화해도 기존 거래 내역은 유지됩니다.</p>
              <StatusSelect id={category.id} active={category.isActive} action={setCategoryActiveAction} label={`${category.name} 활성 상태`} className="mt-3 w-full sm:w-32" />
            </section>

            <section className="border-t border-[var(--tds-grey-200)] pt-4">
              <div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-semibold">소분류</h3><span className="text-xs text-[var(--tds-grey-600)]">항목을 열어 수정하세요</span></div>
              <ul className="mt-2 divide-y divide-[var(--tds-grey-200)] rounded-xl border border-[var(--tds-grey-200)]">
                {category.subcategories.map((sub) => (
                  <li key={sub.id}>
                    <details className="group">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--tds-blue-500)]">
                        <span className={`min-w-0 truncate font-medium ${sub.isActive ? '' : 'text-[var(--tds-grey-500)] line-through'}`}>{sub.name}</span>
                        <span className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sub.isActive ? 'bg-[var(--tds-blue-50)] text-[var(--tds-blue-600)]' : 'bg-[var(--tds-grey-100)] text-[var(--tds-grey-600)]'}`}>{sub.isActive ? '활성' : '비활성'}</span><span className="text-xs text-[var(--tds-grey-600)] group-open:hidden">수정</span><span className="hidden text-xs text-[var(--tds-grey-600)] group-open:inline">접기</span></span>
                      </summary>
                      <div className="border-t border-[var(--tds-grey-200)] bg-[var(--tds-grey-50)] p-3">
                        <form action={subEditAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <input type="hidden" name="id" value={sub.id} />
                          <FormField label="소분류 이름" required className="min-w-0 flex-1"><input name="name" defaultValue={sub.name} required className="px-3 py-2 text-sm" placeholder="소분류 이름" /></FormField>
                          <button type="submit" disabled={subEditPending} className="secondary-button shrink-0 px-4">{subEditPending ? '저장 중…' : '저장'}</button>
                        </form>
                        <StatusSelect id={sub.id} active={sub.isActive} action={setSubcategoryActiveAction} label={`${sub.name} 활성 상태`} className="mt-3 w-full sm:w-32" />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <FormMessage result={subEditState} />
              <form action={subAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <input type="hidden" name="categoryId" value={category.id} />
                <FormField label="새 소분류" required className="min-w-0 flex-1"><input name="name" placeholder="예: 식재료" required className="px-3 py-2 text-sm" /></FormField>
                <button type="submit" disabled={subPending} className="secondary-button shrink-0 px-4">{subPending ? '추가 중…' : '소분류 추가'}</button>
              </form>
              <FormMessage result={subState} />
            </section>
          </div>
        </div>
      )}
    </article>
  );
}
