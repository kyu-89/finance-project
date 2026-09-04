'use client';

import { useActionState, useEffect, useState } from 'react';
import { createMonthlyRowAction } from '@/actions/transaction-actions';
import { AmountInput } from '@/components/AmountInput';
import { CategoryPicker } from '@/components/CategoryPicker';
import { useDrawerControls } from '@/components/Drawer';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

type TransactionType = 'income' | 'expense' | 'reference';
const SUBMIT_LABEL: Record<TransactionType, string> = { income: '수입 추가', expense: '지출 추가', reference: '참고 거래 추가' };

export function MonthlyDrawerForm({ categories, paymentMethods, initialTransactionType = 'expense' }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; initialTransactionType?: TransactionType }) {
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>(initialTransactionType);
  const [incomeGroup, setIncomeGroup] = useState<'fixed' | 'additional'>('fixed');
  // 2026-09(사용자 지시): "지출도 수입처럼 거래 구분(저축성지출/소비성지출)을 똑같이 선택할 수
  // 있어야 한다" — income_group과 완전히 같은 자리·같은 모양의 드롭다운으로 구현한다. 다만
  // 실제 저장되는 expense_group 컬럼은 여전히 category_id로만 DB 트리거가 자동 결정한다(모순
  // 저장을 막기 위함, 사용자 승인 사항) — 이 드롭다운은 그 아래 대분류 선택지를 저축성지출
  // 하나로 좁히거나 나머지로 좁히는 "필터" 역할을 해서, 사용자가 고른 구분과 실제 저장되는
  // 카테고리가 항상 저절로 일치하게 만든다.
  const [expenseGroup, setExpenseGroup] = useState<'savings' | 'consumption'>('consumption');
  const savingsCategory = categories.find((category) => category.transactionType === 'expense' && category.name === '저축성지출');
  const [state, formAction, pending] = useActionState(createMonthlyRowAction, INITIAL_ACTION_STATE);
  const { notifySuccess } = useDrawerControls();
  // 2026-09(사용자 지시): 저장 성공하면 토스트를 띄우고 드로워를 닫는다 — 토스트는 드로워
  // 밖(AddDrawer 자신)에서 뜨므로 드로워가 닫혀도 사라지지 않는다.
  useEffect(() => {
    if (state.ok === true) notifySuccess(state.message ?? '저장했어요.');
  }, [state, notifySuccess]);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  // 2026-09: 참고 거래는 수입·지출과 달리 대분류/소분류가 필수가 아니다(사용자 지시: "단순히
  // 대분류에 '미분류'를 넣는 방식으로 구현하지 않는다" — 진짜로 null 저장을 허용한다). 결제수단은
  // 지출에서만 필수고, 참고 거래에선 선택 사항으로 남겨둔다(카드 대납처럼 결제수단이 있는 경우가
  // 많지만 강제하지 않음). 비용 성격은 지출 전용 개념이라 참고 거래에는 아예 노출하지 않는다.
  const isCategoryRequired = transactionType !== 'reference';
  const missingRequiredPick = (isCategoryRequired && !categoryId) || (transactionType === 'expense' && !paymentMethodId);
  // categories 테이블은 income/expense 두 유형만 갖는다 — 참고 거래를 선택했을 때는 어느 한쪽으로
  // 강제하지 않고 두 유형의 대분류를 모두 후보로 보여준다(선택 안 해도 저장 가능).
  const availableCategories = transactionType === 'reference'
    ? categories.filter((category) => category.isActive)
    : transactionType === 'expense'
      ? categories.filter((category) => category.transactionType === 'expense' && category.isActive && (expenseGroup === 'savings' ? category.id === savingsCategory?.id : category.id !== savingsCategory?.id))
      : categories.filter((category) => category.transactionType === transactionType && category.isActive);

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
          <label className="form-field"><span>거래 유형</span><select value={transactionType} onChange={(event) => { setTransactionType(event.target.value as TransactionType); resetClassification(); }}><option value="expense">지출</option><option value="income">수입</option><option value="reference">참고 거래</option></select></label>
          {transactionType === 'income' && <label className="form-field"><span>거래 구분</span><select name="incomeGroup" value={incomeGroup} onChange={(event) => setIncomeGroup(event.target.value as typeof incomeGroup)}><option value="fixed">고정수입</option><option value="additional">부가 수입</option></select></label>}
          {transactionType === 'expense' && <label className="form-field"><span>거래 구분</span><select value={expenseGroup} onChange={(event) => { setExpenseGroup(event.target.value as typeof expenseGroup); resetClassification(); }}><option value="consumption">소비성지출</option><option value="savings">저축성지출</option></select></label>}
          <label className="form-field"><span>거래일</span><input type="date" name="transactionDate" required /></label>
          {/* 칩은 줄바꿈되며 세로로 자라기 때문에, 2열 그리드에서 짧은 필드와 나란히 두면
              어색하다. 두 열을 다 쓰게 한다(`1 / -1`이라 모바일 1열에서도 안전하다). */}
          <FormField as="div" label="대분류 / 소분류" required={isCategoryRequired} className="[grid-column:1/-1]">
            <CategoryPicker
              // 거래 유형이나 지출 구분이 바뀌면 후보 대분류 목록 자체가 달라지므로 피커 내부
              // 선택 상태도 버려야 한다 — resetClassification()이 비우는 폼 상태와 짝을 맞춘다.
              key={`${transactionType}-${expenseGroup}`}
              categories={availableCategories}
              allowClearSubcategory
              onSelect={(category, pickedSubcategoryId) => {
                setCategoryId(category?.id ?? '');
                setSubcategoryId(pickedSubcategoryId ?? '');
              }}
            />
          </FormField>
        </div>
      </div>
      <div className="monthly-drawer-section">
        <h3>금액과 내용</h3>
        <div className="monthly-drawer-grid">
          <label className="form-field"><span>내용</span><input name="description" placeholder="예: 장보기, 급여" required /></label>
          <label className="form-field"><span>금액</span><AmountInput name="amount" required /></label>
          <label className="form-field [grid-column:1/-1]"><span>비고</span><input name="memo" placeholder="메모를 입력하세요" /></label>
          {transactionType !== 'income' && (
            <FormField as="div" label="결제 수단" required={transactionType === 'expense'} className="[grid-column:1/-1]">
              <PaymentMethodPicker
                paymentMethods={paymentMethods}
                selectedId={paymentMethodId}
                allowClear={transactionType === 'reference'}
                onSelect={(method) => setPaymentMethodId(method?.id ?? '')}
              />
            </FormField>
          )}
          {transactionType === 'expense' && <label className="form-field"><span>비용 성격</span><select name="costBehaviorOverride"><option value="">기본값 사용</option><option value="fixed">고정비</option><option value="variable">변동비</option></select></label>}
        </div>
      </div>
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="subcategoryId" value={subcategoryId} />
      <input type="hidden" name="paymentMethodId" value={transactionType !== 'income' ? paymentMethodId : ''} />
      <input type="hidden" name="categoryDefaultCostBehavior" value={selectedCategory?.defaultCostBehavior ?? ''} />
      <button type="submit" disabled={pending || missingRequiredPick} className="tds-primary-button monthly-drawer-submit">{pending ? '추가하는 중…' : SUBMIT_LABEL[transactionType]}</button>
    </form>
  );
}
