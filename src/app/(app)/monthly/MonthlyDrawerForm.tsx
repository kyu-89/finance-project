'use client';

import { useActionState, useState } from 'react';
import { createMonthlyRowAction } from '@/actions/transaction-actions';
import { AmountInput } from '@/components/AmountInput';
import { CategoryPicker } from '@/components/CategoryPicker';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

type TransactionType = 'income' | 'expense';

export function MonthlyDrawerForm({ categories, paymentMethods, initialTransactionType = 'expense' }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; initialTransactionType?: TransactionType }) {
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>(initialTransactionType);
  const [state, formAction, pending] = useActionState(createMonthlyRowAction, INITIAL_ACTION_STATE);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  // 2026-09: 거래 유형이 수입/지출 두 가지뿐이라 항상 분류 대상이다(과거 환불/저축/투자/대출원금
  // 상환/금융비용/이체 유형은 없어졌고, 환불·취소는 이제 기존 지출 거래의 status 값으로만 표현된다
  // — TransactionStatusEditor 참고).
  const isCategorized = true;
  // 예전에는 대분류/결제수단이 네이티브 `<select required>`라 브라우저가 제출을 막아줬지만,
  // 칩 피커는 hidden input으로 제출하고 hidden input에는 `required`가 적용되지 않는다.
  // 같은 보장을 유지하려면 여기서 직접 막아야 한다(날짜/내용/금액은 여전히 네이티브 required).
  const missingRequiredPick = (isCategorized && !categoryId) || (transactionType === 'expense' && !paymentMethodId);

  function resetClassification() {
    setCategoryId('');
    setSubcategoryId('');
    setPaymentMethodId('');
  }

  return (
    <form action={formAction} className="monthly-drawer-form">
      <FormMessage result={state} />
      <div className="monthly-drawer-section">
        <h3>기본 정보</h3>
        <div className="monthly-drawer-grid">
          <label className="form-field"><span>거래 유형</span><select value={transactionType} onChange={(event) => { setTransactionType(event.target.value as TransactionType); resetClassification(); }}><option value="expense">지출</option><option value="income">수입</option></select></label>
          <label className="form-field"><span>거래일</span><input type="date" name="transactionDate" required /></label>
          {/* 칩은 줄바꿈되며 세로로 자라기 때문에, 2열 그리드에서 짧은 필드와 나란히 두면
              어색하다. 두 열을 다 쓰게 한다(`1 / -1`이라 모바일 1열에서도 안전하다). */}
          {isCategorized && (
            <FormField as="div" label="대분류 / 소분류" required className="[grid-column:1/-1]">
              <CategoryPicker
                // 거래 유형이 바뀌면 후보 대분류 목록 자체가 달라지므로 피커 내부 선택 상태도
                // 버려야 한다 — resetClassification()이 비우는 폼 상태와 짝을 맞춘다.
                key={transactionType}
                categories={categories.filter((category) => category.transactionType === transactionType && category.isActive)}
                allowClearSubcategory
                onSelect={(category, pickedSubcategoryId) => {
                  setCategoryId(category?.id ?? '');
                  setSubcategoryId(pickedSubcategoryId ?? '');
                }}
              />
            </FormField>
          )}
        </div>
      </div>
      <div className="monthly-drawer-section">
        <h3>금액과 내용</h3>
        <div className="monthly-drawer-grid">
          <label className="form-field"><span>내용</span><input name="description" placeholder="예: 장보기, 급여" required /></label>
          <label className="form-field"><span>금액</span><AmountInput name="amount" required /></label>
          <label className="form-field [grid-column:1/-1]"><span>비고</span><input name="memo" placeholder="메모를 입력하세요" /></label>
          {transactionType === 'expense' && (
            <FormField as="div" label="결제 수단" required className="[grid-column:1/-1]">
              <PaymentMethodPicker
                paymentMethods={paymentMethods}
                selectedId={paymentMethodId}
                onSelect={(method) => setPaymentMethodId(method?.id ?? '')}
              />
            </FormField>
          )}
          {transactionType === 'expense' && <label className="form-field"><span>비용 성격</span><select name="costBehaviorOverride"><option value="">기본값 사용</option><option value="fixed">고정비</option><option value="variable">변동비</option></select></label>}
        </div>
      </div>
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="categoryId" value={isCategorized ? categoryId : ''} />
      <input type="hidden" name="subcategoryId" value={isCategorized ? subcategoryId : ''} />
      <input type="hidden" name="paymentMethodId" value={transactionType === 'expense' ? paymentMethodId : ''} />
      <input type="hidden" name="categoryDefaultCostBehavior" value={selectedCategory?.defaultCostBehavior ?? ''} />
      <button type="submit" disabled={pending || missingRequiredPick} className="tds-primary-button monthly-drawer-submit">{pending ? '추가하는 중…' : `${transactionType === 'expense' ? '지출' : transactionType === 'income' ? '수입' : '거래'} 추가`}</button>
    </form>
  );
}
