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
import type { Account } from '@/lib/accounts';
import type { HouseholdMember } from '@/lib/household';

export function QuickAddForm({
  categories,
  paymentMethods,
  accounts,
  members,
  recentCategoryIds,
  recentSubcategoryIdsByCategory,
  saved,
  undoId,
  undone,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  members: HouseholdMember[];
  recentCategoryIds: string[];
  recentSubcategoryIdsByCategory: Record<string, string[]>;
  saved?: string;
  undoId?: string;
  undone: boolean;
}) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSubcategories | null>(null);
  const [transactionType, setTransactionType] = useState<'income' | 'expense' | 'saving' | 'investment' | 'debt_principal' | 'finance_cost' | 'transfer'>('expense');
  const [incomeGroup, setIncomeGroup] = useState<'fixed' | 'additional'>('fixed');
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

      <label className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold text-[var(--tds-grey-700)]">거래 유형</span>
        <select value={transactionType} onChange={(e) => { const next = e.target.value as typeof transactionType; setTransactionType(next); setSelectedCategory(null); setSelectedSubcategoryId(null); setSelectedPaymentMethodId(null); }} className="px-4">
          <option value="expense">지출</option><option value="income">수입</option><option value="saving">저축</option><option value="investment">투자</option><option value="debt_principal">대출 원금상환</option><option value="finance_cost">금융비용</option><option value="transfer">이체</option>
        </select>
      </label>

      {transactionType === 'income' && <><label className="flex flex-col gap-1"><span className="text-[15px] font-semibold text-[var(--tds-grey-700)]">수입 구분</span><select value={incomeGroup} onChange={(e) => setIncomeGroup(e.target.value as typeof incomeGroup)} className="px-4"><option value="fixed">고정수입</option><option value="additional">추가수입</option></select></label><label className="flex flex-col gap-1"><span className="text-[15px] font-semibold text-[var(--tds-grey-700)]">입금계좌</span><select name="accountId" className="px-4"><option value="">선택 안 함</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} {account.accountName}</option>)}</select></label></>}

      {(transactionType === 'income' || transactionType === 'expense') && (
        <div>
          <span className="mb-2 block text-[15px] font-semibold text-[var(--tds-grey-700)]">
            대분류 / 소분류 <span className="text-xs font-medium text-[var(--tds-blue-500)]">필수</span>
          </span>
          <CategoryPicker
            key={`${saved ?? 'initial'}-${transactionType}`}
            categories={categories.filter((category) => category.transactionType === transactionType)}
            recentCategoryIds={recentCategoryIds}
            recentSubcategoryIdsByCategory={recentSubcategoryIdsByCategory}
            onSelect={(category, subcategoryId) => {
              setSelectedCategory(category);
              setSelectedSubcategoryId(subcategoryId);
            }}
          />
        </div>
      )}

      {transactionType === 'expense' && (
        <div>
          <span className="mb-2 block text-[15px] font-semibold text-[var(--tds-grey-700)]">결제수단 <span className="text-xs font-medium text-[var(--tds-blue-500)]">필수</span></span>
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
      )}

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
            <span className="text-sm font-semibold text-[var(--tds-grey-700)]">명의자</span>
            <select name="payerMemberId" className="px-4 py-2">
              <option value="">선택 안 함</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--tds-grey-700)]">비용 귀속자</span>
            <select name="beneficiaryMemberId" className="px-4 py-2">
              <option value="">선택 안 함</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
            </select>
          </label>
          {transactionType === 'expense' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[var(--tds-grey-700)]">비용성격</span>
              <select name="costBehaviorOverride" className="px-4 py-2">
                <option value="">카테고리 기본값 사용</option>
                <option value="fixed">고정비</option>
                <option value="variable">변동비</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--tds-grey-700)]">비고</span>
            <input name="memo" className="px-4 py-2" />
          </label>
        </div>
      )}

      {transactionType === 'income' && <details className="rounded-xl bg-[var(--tds-blue-50)] p-4"><summary className="cursor-pointer text-sm font-semibold">정부지원금 상세 (선택)</summary><div className="mt-3 grid gap-3"><label className="flex flex-col gap-1"><span className="text-sm font-semibold">지원금 종류</span><input name="supportKind" placeholder="예: 아동수당, 주거지원금" /></label></div></details>}
      {transactionType === 'expense' && <details className="rounded-xl bg-[var(--tds-grey-100)] p-4"><summary className="cursor-pointer text-sm font-semibold">경조사 상세 (선택)</summary><div className="mt-3 grid gap-3"><label className="flex flex-col gap-1"><span className="text-sm font-semibold">행사 유형</span><select name="eventType" defaultValue=""><option value="">선택 안 함</option><option value="wedding">결혼</option><option value="condolence">조의</option><option value="gift">선물</option><option value="other">기타</option></select></label><label className="flex flex-col gap-1"><span className="text-sm font-semibold">상대방</span><input name="counterparty" placeholder="상대방 이름 (선택)" /></label><label className="flex flex-col gap-1"><span className="text-sm font-semibold">관계</span><input name="relationshipGroup" placeholder="예: 친척, 직장동료" /></label><label className="flex flex-col gap-1"><span className="text-sm font-semibold">행사 내용</span><input name="eventDescription" placeholder="행사 내용 (선택)" /></label></div></details>}

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
