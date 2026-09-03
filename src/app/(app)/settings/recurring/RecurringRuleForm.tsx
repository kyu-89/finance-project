'use client';
import { useActionState, useState } from 'react';
import { createRecurringRuleAction, updateRecurringRuleAction } from '@/actions/recurring-rule-actions';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/Button';
import { CategoryPicker } from '@/components/CategoryPicker';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { RecurringRule, RecurringSourceType } from '@/lib/recurring-rules';
import type { RecurrenceFrequency } from '@/lib/recurrence';

type TransactionType = 'income' | 'expense';
const SOURCE_TYPE_LABEL: Record<RecurringSourceType, string> = { manual: '일반 반복거래', subscription: '구독', salary: '급여', support: '정부지원금', insurance: '보험', saving: '적금', loan: '대출' };

// 2026-09: 반복 항목 추가/수정을 하나의 컴포넌트로 통일했다(사용자 지시) — 월간관리 수입·지출
// 추가 폼(MonthlyDrawerForm)과 같은 필드 라벨·순서·컴포넌트(CategoryPicker/PaymentMethodPicker)를
// 쓰고, 그 뒤에 반복항목 고유의 "반복 일정" 섹션을 붙인다. `rule`이 있으면 수정 모드로, 기존
// 값을 그대로 채우고 updateRecurringRuleAction으로 저장한다(대출·적금 상품이 자동 생성한
// 반복항목은 호출부인 recurring/page.tsx가 애초에 이 폼을 열지 않는다 — 아래 updateRecurringRule
// 참고).
export function RecurringRuleForm({ categories, paymentMethods, rule }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; rule?: RecurringRule }) {
  const isEdit = Boolean(rule);
  const [state, action, pending] = useActionState(isEdit ? updateRecurringRuleAction : createRecurringRuleAction, INITIAL_ACTION_STATE);
  const [type, setType] = useState<TransactionType>((rule?.transactionType as TransactionType | undefined) ?? 'expense');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [subcategoryId, setSubcategoryId] = useState(rule?.subcategoryId ?? '');
  const [paymentMethodId, setPaymentMethodId] = useState(rule?.paymentMethodId ?? '');
  const [source, setSource] = useState<RecurringSourceType>(rule?.sourceType ?? 'manual');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? 'monthly');
  const selected = categories.find((c) => c.id === categoryId);
  // 예전 select는 브라우저가 required로 막아줬지만 칩 피커는 hidden input이라 여기서 직접 막는다
  // (MonthlyDrawerForm과 같은 패턴).
  const missingRequiredPick = !categoryId || (type === 'expense' && !paymentMethodId);

  function resetClassification() {
    setCategoryId('');
    setSubcategoryId('');
  }

  return <form action={action} className="monthly-drawer-form">
    <FormMessage result={state} />
    {isEdit && <input type="hidden" name="id" value={rule!.id} />}
    <div className="monthly-drawer-section">
      <h3>거래 분류</h3>
      <div className="monthly-drawer-grid">
        <label className="form-field"><span>거래 유형</span><select value={type} onChange={(e) => { setType(e.target.value as TransactionType); resetClassification(); }}><option value="expense">지출</option><option value="income">수입</option></select></label>
        <FormField as="div" label="대분류 / 소분류" required className="[grid-column:1/-1]">
          <CategoryPicker
            key={type}
            categories={categories.filter((c) => c.transactionType === type && (c.isActive || c.id === categoryId))}
            initialCategoryId={categoryId || null}
            initialSubcategoryId={subcategoryId || null}
            allowClearSubcategory
            onSelect={(category, pickedSubcategoryId) => { setCategoryId(category?.id ?? ''); setSubcategoryId(pickedSubcategoryId ?? ''); }}
          />
        </FormField>
      </div>
    </div>
    <div className="monthly-drawer-section">
      <h3>금액과 내용</h3>
      <div className="monthly-drawer-grid">
        <label className="form-field"><span>내용</span><input name="description" defaultValue={rule?.description} placeholder="예: 급여, 보험료, 구독료" required /></label>
        <label className="form-field"><span>기본 금액</span><AmountInput name="amount" defaultValue={rule?.defaultAmount} required /></label>
        <label className="form-field [grid-column:1/-1]"><span>비고</span><input name="memo" defaultValue={rule?.memo ?? ''} placeholder="메모를 입력하세요" /></label>
        {type === 'expense' && (
          <FormField as="div" label="결제 수단" required className="[grid-column:1/-1]">
            <PaymentMethodPicker paymentMethods={paymentMethods} selectedId={paymentMethodId} onSelect={(method) => setPaymentMethodId(method?.id ?? '')} />
          </FormField>
        )}
        {type === 'expense' && <label className="form-field"><span>비용 성격</span><select name="costBehavior" defaultValue={rule?.costBehavior ?? ''}><option value="">카테고리 기본값</option><option value="fixed">고정비</option><option value="variable">변동비</option></select></label>}
      </div>
    </div>
    <div className="monthly-drawer-section">
      <h3>반복 일정</h3>
      <div className="monthly-drawer-grid">
        <label className="form-field"><span>원천</span><select name={isEdit ? undefined : 'sourceType'} value={source} onChange={(e) => setSource(e.target.value as RecurringSourceType)} disabled={isEdit}><option value="manual">{SOURCE_TYPE_LABEL.manual}</option><option value="subscription">{SOURCE_TYPE_LABEL.subscription}</option><option value="salary">{SOURCE_TYPE_LABEL.salary}</option><option value="support">{SOURCE_TYPE_LABEL.support}</option></select></label>
        <label className="form-field"><span>시작일</span><input name="startDate" type="date" defaultValue={rule?.startDate} required /></label>
        <label className="form-field"><span>종료일</span><input name="endDate" type="date" defaultValue={rule?.endDate ?? ''} /></label>
        <label className="form-field"><span>반복 주기</span><select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}><option value="monthly">매월</option><option value="weekly">매주</option><option value="yearly">매년</option><option value="custom">사용자 지정</option></select></label>
        <label className="form-field"><span>반복 간격</span><input name="intervalCount" type="number" min="1" step="1" defaultValue={rule?.intervalCount ?? 1} required placeholder="1" /></label>
        {frequency === 'monthly' && <label className="form-field"><span>매월 지급일</span><input name="dayOfMonth" type="number" min="1" max="31" defaultValue={rule?.dayOfMonth ?? 1} required placeholder="1~31" /></label>}
      </div>
    </div>
    <input type="hidden" name="transactionType" value={type} />
    <input type="hidden" name="categoryId" value={categoryId} />
    <input type="hidden" name="subcategoryId" value={subcategoryId} />
    <input type="hidden" name="paymentMethodId" value={type === 'expense' ? paymentMethodId : ''} />
    <input type="hidden" name="categoryDefaultCostBehavior" value={selected?.defaultCostBehavior ?? ''} />
    <Button type="submit" variant="primary" disabled={pending || missingRequiredPick} className="monthly-drawer-submit">{pending ? '저장 중…' : isEdit ? '변경사항 저장' : '반복 항목 저장'}</Button>
  </form>;
}
