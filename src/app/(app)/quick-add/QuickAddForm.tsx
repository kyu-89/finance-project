'use client';

import { useState } from 'react';
import { createQuickTransactionAction } from '@/actions/transaction-actions';
import { CategoryPicker } from '@/components/CategoryPicker';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function QuickAddForm({
  categories,
  paymentMethods,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSubcategories | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  function handleAmountChange(raw: string) {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setAmountDisplay(digitsOnly ? Number(digitsOnly).toLocaleString('ko-KR') : '');
  }

  const numericAmount = amountDisplay.replace(/,/g, '');

  return (
    <form action={createQuickTransactionAction} className="flex flex-col gap-4">
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
