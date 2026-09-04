'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  createQuickTransactionAction,
  undoTransactionAction,
} from '@/actions/transaction-actions';
import { CategoryPicker } from '@/components/CategoryPicker';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { Account } from '@/lib/accounts';

type TransactionType = 'income' | 'expense' | 'reference';

// 2026-09: 월간관리의 수입/지출/참고 거래 추가 드로워(MonthlyDrawerForm)와 필드 구성·컴포넌트를
// 통일했다(사용자 지시: "갑자기 더보기로 아코디언이 있질 않나, 존재하지 않는 태그 필드가 있지
// 않나 — 일관성 있게 맞춰") — "더보기" 아코디언과 태그 필드를 없애고, 같은 CategoryPicker/
// PaymentMethodPicker/AmountInput/FormField 라벨을 그대로 쓴다. 금액을 맨 위 큰 글씨로 먼저
// 받는 것만은 이 화면의 존재 이유(빠른 입력)라 그대로 유지했다.
export function QuickAddForm({
  categories,
  paymentMethods,
  accounts,
  recentCategoryIds,
  recentSubcategoryIdsByCategory,
  saved,
  undoId,
  undone,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  recentCategoryIds: string[];
  recentSubcategoryIdsByCategory: Record<string, string[]>;
  saved?: string;
  undoId?: string;
  undone: boolean;
}) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [incomeGroup, setIncomeGroup] = useState<'fixed' | 'additional'>('fixed');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const [state, formAction, pending] = useActionState(createQuickTransactionAction, INITIAL_ACTION_STATE);
  const [undoState, undoAction, undoPending] = useActionState(
    undoTransactionAction,
    INITIAL_ACTION_STATE,
  );
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isCategoryRequired = transactionType !== 'reference';
  const availableCategories = transactionType === 'reference'
    ? categories.filter((category) => category.isActive)
    : categories.filter((category) => category.transactionType === transactionType && category.isActive);

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
    setCategoryId('');
    setSubcategoryId('');
    setPaymentMethodId('');
    setTransactionType('expense');
    setIncomeGroup('fixed');
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

  function resetClassification() {
    setCategoryId('');
    setSubcategoryId('');
    setPaymentMethodId('');
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
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="incomeGroup" value={transactionType === 'income' ? incomeGroup : ''} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="categoryDefaultCostBehavior" value={selectedCategory?.defaultCostBehavior ?? ''} />
      <input type="hidden" name="subcategoryId" value={subcategoryId} />
      <input type="hidden" name="paymentMethodId" value={transactionType !== 'income' ? paymentMethodId : ''} />

      <FormField label="금액">
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
      </FormField>

      <FormField label="거래 유형">
        <select value={transactionType} onChange={(e) => { setTransactionType(e.target.value as TransactionType); resetClassification(); }} className="px-4">
          <option value="expense">지출</option><option value="income">수입</option><option value="reference">참고 거래</option>
        </select>
      </FormField>

      <FormField as="div" label="대분류 / 소분류" required={isCategoryRequired}>
        <CategoryPicker
          key={transactionType}
          categories={availableCategories}
          recentCategoryIds={recentCategoryIds}
          recentSubcategoryIdsByCategory={recentSubcategoryIdsByCategory}
          allowClearCategory={!isCategoryRequired}
          onSelect={(category, pickedSubcategoryId) => {
            setCategoryId(category?.id ?? '');
            setSubcategoryId(pickedSubcategoryId ?? '');
          }}
        />
      </FormField>

      <FormField label="내용">
        <input name="description" required className="px-4 py-3" placeholder="예: 저녁 식사" />
      </FormField>

      <FormField label="비고">
        <input name="memo" className="px-4 py-2" placeholder="메모를 입력하세요" />
      </FormField>

      {transactionType !== 'income' && (
        <FormField as="div" label="결제 수단" required={transactionType === 'expense'}>
          <PaymentMethodPicker
            paymentMethods={paymentMethods}
            selectedId={paymentMethodId}
            allowClear={transactionType === 'reference'}
            onSelect={(method) => setPaymentMethodId(method?.id ?? '')}
          />
        </FormField>
      )}

      {transactionType === 'expense' && (
        <FormField label="비용 성격">
          <select name="costBehaviorOverride" className="px-4 py-2">
            <option value="">기본값 사용</option>
            <option value="fixed">고정비</option>
            <option value="variable">변동비</option>
          </select>
        </FormField>
      )}

      {transactionType === 'income' && <><FormField label="거래 구분"><select value={incomeGroup} onChange={(e) => setIncomeGroup(e.target.value as typeof incomeGroup)} className="px-4"><option value="fixed">고정수입</option><option value="additional">추가수입</option></select></FormField><FormField label="입금계좌"><select name="accountId" className="px-4"><option value="">선택 안 함</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} {account.accountName}</option>)}</select></FormField></>}

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
