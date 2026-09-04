'use client';
import { useActionState, useState } from 'react';
import { updateTransactionAction, saveEventDetailAction, saveSupportDetailAction } from '@/actions/transaction-detail-actions';
import { deleteTransactionAction, linkRecurringOccurrenceAction } from '@/actions/transaction-actions';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/Button';
import { CategoryPicker } from '@/components/CategoryPicker';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Transaction } from '@/lib/transactions';
import type { EventDetail, SupportDetail } from '@/lib/transaction-details';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

// 2026-09: 등록 드로워(MonthlyDrawerForm)와 필드 구성·라벨을 통일했다 — 예전에는 "거래 정보"
// (날짜/금액/내용/메모/태그)와 "분류"(대분류·소분류/결제수단)가 서로 다른 폼·다른 저장
// 버튼으로 나뉘어 있었고, 라벨도 "메모"(등록 드로워는 "비고")로 어긋나 있었다. 지금은 등록
// 드로워와 똑같은 하나의 폼(거래 유형/거래일/대분류·소분류/내용/금액/비고/결제수단/비용성격)에
// "정보 수정" 버튼 하나로 저장한다. 태그는 등록 드로워에 애초에 없던 필드라 함께 뺐다(등록
// 시 유일하게 태그를 받는 화면은 /quick-add다). 삭제·지원금 상세·경조사 상세·기존 거래 연결은
// 수정 화면에만 필요한 기능이라 그대로 남겨둔다.
export function TransactionDetailDrawer({ transaction, support, event, categories = [], paymentMethods = [], candidates = [], showEvent = false, showSupport = false, onClose }: { transaction: Transaction; support?: SupportDetail; event?: EventDetail; categories?: CategoryWithSubcategories[]; paymentMethods?: PaymentMethod[]; candidates?: DuplicateCandidate[]; showEvent?: boolean; showSupport?: boolean; onClose: () => void }) {
  const [updateState, updateAction, updatePending] = useActionState(updateTransactionAction, INITIAL_ACTION_STATE);
  const [supportState, supportAction, supportPending] = useActionState(saveSupportDetailAction, INITIAL_ACTION_STATE);
  const [eventState, eventAction, eventPending] = useActionState(saveEventDetailAction, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTransactionAction, INITIAL_ACTION_STATE);
  const [linkState, linkAction, linkPending] = useActionState(linkRecurringOccurrenceAction, INITIAL_ACTION_STATE);

  // 칩 피커는 hidden input으로 제출하므로 폼 상태를 React가 직접 들고 있어야 한다(MonthlyDrawerForm과
  // 같은 패턴). 이 드로어는 부모가 `key={transaction.id}`로 렌더하므로(다른 거래를 열면 컴포넌트가
  // 통째로 새로 마운트됨) 여기서는 최초 값만 seed하면 되고, 거래가 바뀔 때 값을 다시 맞추는 별도
  // resync 로직이 필요 없다.
  const [transactionType, setTransactionType] = useState<Transaction['transactionType']>(transaction.transactionType);
  // 2026-09(사용자 지시): 등록 드로워와 대칭으로 수정 드로워에도 거래 구분(income_group)을
  // 노출한다. expense_group은 카테고리로 자동 결정돼 여기서 따로 입력받지 않는다.
  const [incomeGroup, setIncomeGroup] = useState<'fixed' | 'additional'>(transaction.incomeGroup ?? 'fixed');
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '');
  const [subcategoryId, setSubcategoryId] = useState(transaction.subcategoryId ?? '');
  const [paymentMethodId, setPaymentMethodId] = useState(transaction.paymentMethodId ?? '');
  const selectedCategory = categories.find((category) => category.id === categoryId);
  // 참고 거래는 대분류·소분류가 필수가 아니다(사용자 지시) — 수입·지출로 전환하면 그 즉시 다시
  // 필수 검증이 걸린다(isCategoryRequired가 transactionType을 그대로 따라가므로).
  const isCategoryRequired = transactionType !== 'reference';
  const missingRequiredPick = (isCategoryRequired && !categoryId) || (transactionType === 'expense' && !paymentMethodId);
  const availableCategories = transactionType === 'reference'
    ? categories.filter((category) => category.isActive || category.id === categoryId)
    : categories.filter((category) => category.transactionType === transactionType && (category.isActive || category.id === categoryId));

  function resetClassification() {
    setCategoryId('');
    setSubcategoryId('');
    setPaymentMethodId('');
  }

  return <div className="fixed inset-0 z-50 bg-black/30" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-label="거래 상세"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--tds-blue-600)]">거래 상세</p><h2 className="mt-1 text-xl font-bold">{transaction.description}</h2></div><Button type="button" variant="ghost" onClick={onClose} className="px-3" aria-label="상세 닫기">닫기</Button></div>
    <form action={updateAction} className="monthly-drawer-form mt-6">
      <input type="hidden" name="id" value={transaction.id} />
      <FormMessage result={updateState} />
      <div className="monthly-drawer-section">
        <h3>기본 정보</h3>
        <div className="monthly-drawer-grid">
          <label className="form-field"><span>거래 유형</span><select value={transactionType} onChange={(event) => { setTransactionType(event.target.value as Transaction['transactionType']); resetClassification(); }}><option value="expense">지출</option><option value="income">수입</option><option value="reference">참고 거래</option></select></label>
          {transactionType === 'income' && <label className="form-field"><span>거래 구분</span><select name="incomeGroup" value={incomeGroup} onChange={(event) => setIncomeGroup(event.target.value as typeof incomeGroup)}><option value="fixed">고정수입</option><option value="additional">추가수입</option></select></label>}
          <label className="form-field"><span>거래일</span><input type="date" name="transactionDate" defaultValue={transaction.transactionDate} required /></label>
          <FormField as="div" label="대분류 / 소분류" required={isCategoryRequired} className="[grid-column:1/-1]">
            <CategoryPicker
              // 거래 유형이 바뀌면 후보 대분류 목록 자체가 달라지므로 피커 내부 선택 상태도
              // 버려야 한다 — resetClassification()이 비우는 폼 상태와 짝을 맞춘다.
              key={transactionType}
              categories={availableCategories}
              initialCategoryId={categoryId || null}
              initialSubcategoryId={subcategoryId || null}
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
          <label className="form-field"><span>내용</span><input name="description" defaultValue={transaction.description} placeholder="예: 장보기, 급여" required /></label>
          <label className="form-field"><span>금액</span><AmountInput name="amount" defaultValue={transaction.amount} required /></label>
          <label className="form-field [grid-column:1/-1]"><span>비고</span><input name="memo" defaultValue={transaction.memo ?? ''} placeholder="메모를 입력하세요" /></label>
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
          {transactionType === 'expense' && <label className="form-field"><span>비용 성격</span><select name="costBehaviorOverride" defaultValue={transaction.costBehavior ?? ''}><option value="">기본값 사용</option><option value="fixed">고정비</option><option value="variable">변동비</option></select></label>}
        </div>
      </div>
      <input type="hidden" name="transactionType" value={transactionType} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="subcategoryId" value={subcategoryId} />
      <input type="hidden" name="paymentMethodId" value={transactionType !== 'income' ? paymentMethodId : ''} />
      <input type="hidden" name="categoryDefaultCostBehavior" value={selectedCategory?.defaultCostBehavior ?? ''} />
      <Button type="submit" variant="primary" disabled={updatePending || missingRequiredPick} className="monthly-drawer-submit">{updatePending ? '저장 중…' : '정보 수정'}</Button>
    </form>
    {showSupport && <DetailSection title="정부지원금 상세"><form action={supportAction} className="grid gap-3"><input type="hidden" name="transactionId" value={transaction.id} /><Field name="supportKind" label="지원금 종류" defaultValue={support?.supportKind ?? ''} required /><Field name="issuer" label="지급기관" defaultValue={support?.issuer ?? ''} /><Field name="eligibility" label="신청 조건" defaultValue={support?.eligibility ?? ''} /><Field name="applicationPeriod" label="신청 기간" defaultValue={support?.applicationPeriod ?? ''} /><Field name="receivingPeriod" label="수령 기간" defaultValue={support?.receivingPeriod ?? ''} /><div className="grid gap-3 sm:grid-cols-2"><Field name="expectedDate" label="예상 지급일" type="date" defaultValue={support?.expectedDate ?? ''} /><FormField label="회차 금액"><AmountInput name="amountPerOccurrence" defaultValue={support?.amountPerOccurrence ?? ''} className="px-3" /></FormField></div><Button type="submit" variant="secondary" disabled={supportPending}>{supportPending ? '저장 중…' : '지원금 상세 저장'}</Button><FormMessage result={supportState} /></form></DetailSection>}
    {showEvent && <DetailSection title="경조사 상세"><form action={eventAction} className="grid gap-3"><input type="hidden" name="transactionId" value={transaction.id} /><FormField label="행사 유형"><select name="eventType" defaultValue={event?.eventType ?? 'other'} className="px-3"><option value="wedding">결혼</option><option value="condolence">조의</option><option value="gift">선물</option><option value="other">기타</option></select></FormField><Field name="counterparty" label="상대방" defaultValue={event?.counterparty ?? ''} /><Field name="relationshipGroup" label="관계" defaultValue={event?.relationshipGroup ?? ''} /><Field name="eventDescription" label="행사 내용" defaultValue={event?.eventDescription ?? ''} /><Button type="submit" variant="secondary" disabled={eventPending}>{eventPending ? '저장 중…' : '경조사 상세 저장'}</Button><FormMessage result={eventState} /></form></DetailSection>}
    {transaction.status === 'planned' && transaction.recurringOccurrenceId && candidates.length > 0 && <DetailSection title="기존 거래와 연결"><form action={linkAction} className="grid gap-3"><input type="hidden" name="occurrenceId" value={transaction.recurringOccurrenceId} /><input type="hidden" name="plannedTransactionId" value={transaction.id} /><select name="postedTransactionId" className="px-3" aria-label="연결할 기존 거래">{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.transactionDate} · {candidate.description}</option>)}</select><Button type="submit" variant="secondary" disabled={linkPending}>{linkPending ? '연결 중…' : '기존 거래와 연결'}</Button><FormMessage result={linkState} /></form></DetailSection>}
    <section className="mt-7 border-t pt-6"><form action={deleteAction} className="flex items-center justify-between gap-3"><input type="hidden" name="id" value={transaction.id} /><p className="text-xs text-[var(--tds-grey-500)]">삭제한 거래는 원장에서 숨겨집니다.</p><Button type="submit" variant="danger" disabled={deletePending}>{deletePending ? '삭제 중…' : '거래 삭제'}</Button></form><FormMessage result={deleteState} /></section>
  </aside></div>;
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-7 border-t pt-6"><h3 className="text-lg font-bold">{title}</h3><div className="mt-3">{children}</div></section>; }
function Field({ name, label, defaultValue, type = 'text', required = false }: { name: string; label: string; defaultValue: string; type?: string; required?: boolean }) { return <FormField label={label} required={required}><input name={name} type={type} defaultValue={defaultValue} required={required} className="px-3" /></FormField>; }
