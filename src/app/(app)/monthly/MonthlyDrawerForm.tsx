'use client';

import { useActionState, useState } from 'react';
import { createMonthlyRowAction } from '@/actions/transaction-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

type TransactionType = 'income' | 'expense' | 'saving' | 'investment' | 'debt_principal' | 'finance_cost' | 'transfer';

export function MonthlyDrawerForm({ categories, paymentMethods }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[] }) {
  const [categoryId, setCategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [state, formAction, pending] = useActionState(createMonthlyRowAction, INITIAL_ACTION_STATE);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isCategorized = transactionType === 'income' || transactionType === 'expense';

  return (
    <form action={formAction} className="monthly-drawer-form">
      <FormMessage result={state} />
      <div className="monthly-drawer-section">
        <h3>기본 정보</h3>
        <div className="monthly-drawer-grid">
          <label className="form-field"><span>거래 유형</span><select value={transactionType} onChange={(event) => { setTransactionType(event.target.value as TransactionType); setCategoryId(''); }}><option value="expense">지출</option><option value="income">수입</option><option value="saving">저축</option><option value="investment">투자</option><option value="debt_principal">대출 원금 상환</option><option value="finance_cost">금융 비용</option><option value="transfer">이체</option></select></label>
          <label className="form-field"><span>거래일</span><input type="date" name="transactionDate" required /></label>
          {isCategorized && <label className="form-field"><span>분류</span><select name="categoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">분류를 선택하세요</option>{categories.filter((category) => category.transactionType === transactionType && category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
          {isCategorized && <label className="form-field"><span>세부 분류 <em>선택</em></span><select name="subcategoryId"><option value="">세부 분류 없음</option>{selectedCategory?.subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select></label>}
        </div>
      </div>
      <div className="monthly-drawer-section">
        <h3>금액과 내용</h3>
        <div className="monthly-drawer-grid">
          <label className="form-field"><span>내용</span><input name="description" placeholder="예: 장보기, 급여" required /></label>
          <label className="form-field"><span>금액</span><input name="amount" type="number" inputMode="numeric" min="1" step="1" placeholder="금액을 입력하세요" required /></label>
          {transactionType === 'expense' && <label className="form-field"><span>결제 수단</span><select name="paymentMethodId" required><option value="">결제 수단을 선택하세요</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>}
          {transactionType === 'expense' && <label className="form-field"><span>비용 성격 <em>선택</em></span><select name="costBehaviorOverride"><option value="">기본값 사용</option><option value="fixed">고정비</option><option value="variable">변동비</option></select></label>}
        </div>
      </div>
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="categoryDefaultCostBehavior" value={selectedCategory?.defaultCostBehavior ?? ''} />
      <button type="submit" disabled={pending} className="tds-primary-button monthly-drawer-submit">{pending ? '추가하는 중…' : `${transactionType === 'expense' ? '지출' : transactionType === 'income' ? '수입' : '거래'} 추가`}</button>
    </form>
  );
}
