'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  createQuickTransactionAction,
  undoTransactionAction,
} from '@/actions/transaction-actions';
import { CategoryPicker } from '@/components/CategoryPicker';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function QuickAddForm({
  categories,
  paymentMethods,
  recentCategoryIds,
  recentSubcategoryIdsByCategory,
  saved,
  undoId,
  undone,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  recentCategoryIds: string[];
  recentSubcategoryIdsByCategory: Record<string, string[]>;
  saved?: string;
  undoId?: string;
  undone: boolean;
}) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSubcategories | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const [state, formAction, pending] = useActionState(createQuickTransactionAction, INITIAL_ACTION_STATE);
  const [undoState, undoAction, undoPending] = useActionState(
    undoTransactionAction,
    INITIAL_ACTION_STATE,
  );

  // The quick-add form is a same-segment navigation target (`/quick-add?saved=...`), so React
  // state above survives the redirect — without this the user taps 저장 and sees no visible
  // change at all. `saved` is a unique value per save (see the action's redirect), so this needs
  // to re-fire on every save, not just the first one.
  //
  // This follows React's "adjusting state when a prop changes" render-time pattern rather than
  // an effect, because calling several setState()s synchronously inside an effect body triggers
  // cascading renders (flagged by react-hooks/set-state-in-effect) — computing the reset during
  // render lets React batch it into the same render pass instead.
  const [handledSaved, setHandledSaved] = useState(saved);
  if (saved !== handledSaved) {
    setHandledSaved(saved);
    setShowSavedBanner(true);
    setAmountDisplay('');
    setSelectedCategory(null);
    setSelectedSubcategoryId(null);
    setSelectedPaymentMethodId(null);
  }

  // Auto-hide the confirmation banner after a few seconds. Unlike the reset above, this setState
  // happens inside a setTimeout callback, not synchronously in the effect body, so it's exempt
  // from the same rule.
  useEffect(() => {
    if (!showSavedBanner) {
      return;
    }
    const timer = setTimeout(() => setShowSavedBanner(false), 5000);
    return () => clearTimeout(timer);
  }, [showSavedBanner]);

  function handleAmountChange(raw: string) {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setAmountDisplay(digitsOnly ? Number(digitsOnly).toLocaleString('ko-KR') : '');
  }

  const numericAmount = amountDisplay.replace(/,/g, '');

  return (
    // Remount the whole form subtree on each save. The state-adjustment block above resets the
    // controlled state, but `description`/`memo` are uncontrolled native inputs whose DOM nodes
    // survive this same-segment navigation untouched — so without this key the user sees
    // "저장되었습니다" while the previous entry's text is still sitting in the 내용 box.
    <form
      key={saved ?? 'initial'}
      action={formAction}
      className="tds-card flex flex-col gap-6 p-5 md:p-6"
    >
      {showSavedBanner && (
        <div className="flex items-center justify-between rounded-[14px] bg-[var(--tds-grey-900)] px-4 py-3 text-sm text-white shadow-[0_8px_24px_oklch(0.155_0.06_261/0.16)]">
          <span>저장되었습니다</span>
          {undoId && (
            <button
              type="submit"
              name="id"
              value={undoId}
              formAction={undoAction}
              formNoValidate
              disabled={undoPending}
              className="min-h-11 px-2 font-semibold text-white underline underline-offset-4"
            >
              {undoPending ? '취소 중...' : '실행취소'}
            </button>
          )}
        </div>
      )}
      {undone && (
        <p className="rounded-xl bg-[var(--tds-blue-50)] px-4 py-3 text-sm text-[var(--tds-blue-600)]">
          방금 저장한 거래를 취소했어요.
        </p>
      )}
      <FormMessage result={state} />
      <FormMessage result={undoState} />
      <input type="hidden" name="transactionType" value="expense" />
      <input type="hidden" name="categoryId" value={selectedCategory?.id ?? ''} />
      <input
        type="hidden"
        name="categoryDefaultCostBehavior"
        value={selectedCategory?.defaultCostBehavior ?? ''}
      />
      <input type="hidden" name="subcategoryId" value={selectedSubcategoryId ?? ''} />
      <input type="hidden" name="paymentMethodId" value={selectedPaymentMethodId ?? ''} />

      <label className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold text-[var(--tds-grey-700)]">금액</span>
        <input
          inputMode="numeric"
          autoFocus
          value={amountDisplay}
          onChange={(e) => handleAmountChange(e.target.value)}
          className="px-4 py-3 text-[28px] font-bold tabular-nums tracking-[-0.02em]"
          placeholder="0"
        />
        {/* real amount, digits only, submitted alongside the display value */}
        <input type="hidden" name="amount" value={numericAmount} />
      </label>

      <div>
        <span className="mb-2 block text-[15px] font-semibold text-[var(--tds-grey-700)]">대분류 / 소분류</span>
        <CategoryPicker
          key={saved ?? 'initial'}
          categories={categories}
          recentCategoryIds={recentCategoryIds}
          recentSubcategoryIdsByCategory={recentSubcategoryIdsByCategory}
          onSelect={(category, subcategoryId) => {
            setSelectedCategory(category);
            setSelectedSubcategoryId(subcategoryId);
          }}
        />
      </div>

      <div>
        <span className="mb-2 block text-[15px] font-semibold text-[var(--tds-grey-700)]">결제수단</span>
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setSelectedPaymentMethodId(method.id)}
              data-selected={selectedPaymentMethodId === method.id}
              className="tds-chip px-4"
            >
              {method.name}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold text-[var(--tds-grey-700)]">내용</span>
        <input name="description" required className="px-4 py-3" placeholder="예: 저녁 식사" />
      </label>

      <button type="button" onClick={() => setShowMore((v) => !v)} className="min-h-11 text-left text-sm font-semibold text-[var(--tds-blue-500)]">
        {showMore ? '접기' : '더보기 (명의자/비고/태그)'}
      </button>
      {showMore && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--tds-grey-700)]">비용성격</span>
            <select name="costBehaviorOverride" className="px-4 py-2">
              <option value="">카테고리 기본값 사용</option>
              <option value="fixed">고정비</option>
              <option value="variable">변동비</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--tds-grey-700)]">비고</span>
            <input name="memo" className="px-4 py-2" />
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="tds-primary-button px-5"
      >
        {pending ? '저장 중...' : '저장'}
      </button>
    </form>
  );
}
