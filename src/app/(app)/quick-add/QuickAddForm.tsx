'use client';

import { useEffect, useState } from 'react';
import { createQuickTransactionAction } from '@/actions/transaction-actions';
import { CategoryPicker } from '@/components/CategoryPicker';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function QuickAddForm({
  categories,
  paymentMethods,
  saved,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  saved?: string;
}) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSubcategories | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [showSavedBanner, setShowSavedBanner] = useState(false);

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
    const timer = setTimeout(() => setShowSavedBanner(false), 3000);
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
      action={createQuickTransactionAction}
      className="flex flex-col gap-4"
    >
      {showSavedBanner && (
        <div className="rounded border border-green-500 bg-green-50 px-3 py-2 text-sm text-green-700">
          저장되었습니다
        </div>
      )}
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
        <span className="text-sm text-gray-600">금액</span>
        <input
          inputMode="numeric"
          autoFocus
          value={amountDisplay}
          onChange={(e) => handleAmountChange(e.target.value)}
          className="rounded border px-3 py-3 text-2xl"
          placeholder="0"
        />
        {/* real amount, digits only, submitted alongside the display value */}
        <input type="hidden" name="amount" value={numericAmount} />
      </label>

      <div>
        <span className="mb-1 block text-sm text-gray-600">대분류 / 소분류</span>
        <CategoryPicker
          key={saved ?? 'initial'}
          categories={categories}
          onSelect={(category, subcategoryId) => {
            setSelectedCategory(category);
            setSelectedSubcategoryId(subcategoryId);
          }}
        />
      </div>

      <div>
        <span className="mb-1 block text-sm text-gray-600">결제수단</span>
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setSelectedPaymentMethodId(method.id)}
              className={`rounded border px-3 py-1 text-sm ${
                selectedPaymentMethodId === method.id ? 'bg-black text-white' : ''
              }`}
            >
              {method.name}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-600">내용</span>
        <input name="description" required className="rounded border px-3 py-2" />
      </label>

      <button type="button" onClick={() => setShowMore((v) => !v)} className="text-left text-sm text-gray-500">
        {showMore ? '접기' : '더보기 (명의자/비고/태그)'}
      </button>
      {showMore && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">비고</span>
          <input name="memo" className="rounded border px-3 py-2" />
        </label>
      )}

      <button type="submit" className="rounded bg-black px-4 py-3 text-lg text-white">
        저장
      </button>
    </form>
  );
}
