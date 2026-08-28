'use client';

import { useActionState, useState } from 'react';
import { createRecurringRuleAction } from '@/actions/recurring-rule-actions';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function RecurringRuleForm({
  categories,
  paymentMethods,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const [state, formAction, pending] = useActionState(createRecurringRuleAction, INITIAL_ACTION_STATE);
  const [frequency, setFrequency] = useState('monthly');
  const [categoryId, setCategoryId] = useState('');
  const selectedCategory = categories.find((category) => category.id === categoryId);

  return (
    <form action={formAction} className="tds-card grid gap-4 p-5 md:grid-cols-2">
      <div className="md:col-span-2"><FormMessage result={state} /></div>
      <label className="flex flex-col gap-1 text-sm">이름
        <input name="description" required placeholder="예: 월세" className="px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">기본 금액
        <input name="amount" type="number" min="1" step="1" inputMode="numeric" required className="px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">종류
        <select name="sourceType" className="px-3 py-2">
          <option value="manual">일반 반복거래</option><option value="subscription">구독</option>
          <option value="salary">급여</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">거래 유형
        <select name="transactionType" className="px-3 py-2">
          <option value="expense">소비 지출</option><option value="income">수입</option>
          <option value="saving">저축</option><option value="investment">투자</option>
          <option value="debt_principal">대출 원금</option><option value="finance_cost">금융 비용</option>
          <option value="transfer">이체</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">시작일
        <input name="startDate" type="date" required className="px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">종료일 (선택)
        <input name="endDate" type="date" className="px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">반복 주기
        <select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)} className="px-3 py-2">
          <option value="monthly">개월</option><option value="weekly">주</option>
          <option value="yearly">년</option><option value="custom">일</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">반복 간격
        <input name="intervalCount" type="number" min="1" step="1" defaultValue="1" required className="px-3 py-2" />
      </label>
      {frequency === 'monthly' && <label className="flex flex-col gap-1 text-sm">매월 납부일
        <input name="dayOfMonth" type="number" min="1" max="31" defaultValue="1" required className="px-3 py-2" />
      </label>}
      <label className="flex flex-col gap-1 text-sm">비용 성격
        <select name="costBehavior" className="px-3 py-2">
          <option value="">카테고리 기본값</option><option value="fixed">고정비</option><option value="variable">변동비</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">카테고리 (선택)
        <select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="px-3 py-2"><option value="">선택 안 함</option>
          {categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">소분류 (선택)
        <select key={categoryId} name="subcategoryId" disabled={!selectedCategory} className="px-3 py-2"><option value="">선택 안 함</option>
          {selectedCategory?.subcategories.filter((subcategory) => subcategory.isActive).map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">결제수단 (선택)
        <select name="paymentMethodId" className="px-3 py-2"><option value="">선택 안 함</option>
          {paymentMethods.filter((method) => method.isActive).map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pending} className="tds-primary-button md:col-span-2">
        {pending ? '저장 중...' : '반복항목 추가'}
      </button>
    </form>
  );
}
