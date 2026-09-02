'use client';
import { useActionState, useState } from 'react';
import { updateTransactionBasicsAction, updateTransactionClassificationAction, saveEventDetailAction, saveSupportDetailAction } from '@/actions/transaction-detail-actions';
import { deleteTransactionAction, linkRecurringOccurrenceAction } from '@/actions/transaction-actions';
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

export function TransactionDetailDrawer({ transaction, support, event, categories = [], paymentMethods = [], candidates = [], showEvent = false, showSupport = false, onClose }: { transaction: Transaction; support?: SupportDetail; event?: EventDetail; categories?: CategoryWithSubcategories[]; paymentMethods?: PaymentMethod[]; candidates?: DuplicateCandidate[]; showEvent?: boolean; showSupport?: boolean; onClose: () => void }) {
  const [basicState, basicAction, basicPending] = useActionState(updateTransactionBasicsAction, INITIAL_ACTION_STATE);
  const [classificationState, classificationAction, classificationPending] = useActionState(updateTransactionClassificationAction, INITIAL_ACTION_STATE);
  const [supportState, supportAction, supportPending] = useActionState(saveSupportDetailAction, INITIAL_ACTION_STATE);
  const [eventState, eventAction, eventPending] = useActionState(saveEventDetailAction, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTransactionAction, INITIAL_ACTION_STATE);
  const [linkState, linkAction, linkPending] = useActionState(linkRecurringOccurrenceAction, INITIAL_ACTION_STATE);
  // 분류 폼은 네이티브 select의 defaultValue 대신 칩 피커를 쓰므로, 기존 선택값을 React 상태로
  // 들고 hidden input으로 제출한다(QuickAddForm과 같은 패턴).
  const [categoryId, setCategoryId] = useState<string | null>(transaction.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(transaction.subcategoryId ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(transaction.paymentMethodId ?? null);
  // 이 드로어는 호출부에서 `{selected && <TransactionDetailDrawer transaction={selected} …/>}`로
  // 렌더되기 때문에, 다른 거래로 바뀌어도 같은 위치·같은 타입이면 컴포넌트가 언마운트되지 않고
  // 위 상태가 그대로 남는다(= 이전 거래의 분류가 보이는 상태). QuickAddForm의
  // "adjusting state when a prop changes" 렌더타임 패턴으로 맞춘다.
  const [syncedTransactionId, setSyncedTransactionId] = useState(transaction.id);
  if (transaction.id !== syncedTransactionId) {
    setSyncedTransactionId(transaction.id);
    setCategoryId(transaction.categoryId ?? null);
    setSubcategoryId(transaction.subcategoryId ?? null);
    setPaymentMethodId(transaction.paymentMethodId ?? null);
  }
  // 비활성 대분류는 새로 고를 수 없게 걸러내되(기존 select와 동일), 이 거래가 지금 쓰고 있는
  // 대분류는 비활성이어도 남겨둔다 — 없으면 선택된 칩이 하나도 없는데 폼은 그 id를 제출하는
  // 상태가 된다.
  const classificationCategories = categories.filter((category) => category.transactionType === transaction.transactionType && (category.isActive || category.id === categoryId));
  return <div className="fixed inset-0 z-50 bg-black/30" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-label="거래 상세"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--tds-blue-600)]">거래 상세</p><h2 className="mt-1 text-xl font-bold">{transaction.description}</h2></div><Button type="button" variant="ghost" onClick={onClose} className="px-3" aria-label="상세 닫기">닫기</Button></div>
    <form action={basicAction} className="mt-6 grid gap-3"><input type="hidden" name="id" value={transaction.id} /><FormField label="날짜" required><input name="transactionDate" type="date" defaultValue={transaction.transactionDate} required className="px-3" /></FormField><FormField label="금액" required><input name="amount" type="number" min="1" step="1" defaultValue={transaction.amount} required className="px-3 text-right" /></FormField><FormField label="내용" required><input name="description" defaultValue={transaction.description} required className="px-3" /></FormField><FormField label="메모"><textarea name="memo" defaultValue={transaction.memo ?? ''} rows={3} className="px-3 py-2" /></FormField><FormField label="태그"><input name="tags" defaultValue={transaction.tags?.join(', ') ?? ''} placeholder="예: 여행, 교육 (쉼표로 구분)" className="px-3" /></FormField><Button type="submit" variant="primary" disabled={basicPending}>{basicPending ? '저장 중…' : '거래 정보 저장'}</Button><FormMessage result={basicState} /></form>
    <form action={classificationAction} className="mt-6 grid gap-3"><input type="hidden" name="id" value={transaction.id} /><input type="hidden" name="categoryId" value={categoryId ?? ''} /><input type="hidden" name="subcategoryId" value={subcategoryId ?? ''} /><input type="hidden" name="paymentMethodId" value={paymentMethodId ?? ''} /><h3 className="text-lg font-bold">분류와 결제수단</h3>
      <FormField as="div" label="대분류 / 소분류">
        <CategoryPicker
          // initialCategoryId/initialSubcategoryId는 useState 초기값으로 한 번만 읽히므로,
          // 위 resync처럼 다른 거래로 바뀔 때 피커 내부 상태도 새로 seed되도록 remount시킨다.
          key={transaction.id}
          categories={classificationCategories}
          initialCategoryId={transaction.categoryId}
          initialSubcategoryId={transaction.subcategoryId}
          allowClearCategory
          allowClearSubcategory
          onSelect={(category, pickedSubcategoryId) => { setCategoryId(category?.id ?? null); setSubcategoryId(pickedSubcategoryId); }}
        />
      </FormField>
      <FormField as="div" label="결제수단">
        <PaymentMethodPicker paymentMethods={paymentMethods} selectedId={paymentMethodId} onSelect={(method) => setPaymentMethodId(method?.id ?? null)} allowClear />
      </FormField>
      <Button type="submit" variant="primary" disabled={classificationPending}>{classificationPending ? '저장 중…' : '분류 저장'}</Button><FormMessage result={classificationState} /></form>
    {showSupport && <DetailSection title="정부지원금 상세"><form action={supportAction} className="grid gap-3"><input type="hidden" name="transactionId" value={transaction.id} /><Field name="supportKind" label="지원금 종류" defaultValue={support?.supportKind ?? ''} required /><Field name="issuer" label="지급기관" defaultValue={support?.issuer ?? ''} /><Field name="eligibility" label="신청 조건" defaultValue={support?.eligibility ?? ''} /><Field name="applicationPeriod" label="신청 기간" defaultValue={support?.applicationPeriod ?? ''} /><Field name="receivingPeriod" label="수령 기간" defaultValue={support?.receivingPeriod ?? ''} /><div className="grid gap-3 sm:grid-cols-2"><Field name="expectedDate" label="예상 지급일" type="date" defaultValue={support?.expectedDate ?? ''} /><Field name="amountPerOccurrence" label="회차 금액" type="number" defaultValue={support?.amountPerOccurrence?.toString() ?? ''} /></div><Button type="submit" variant="secondary" disabled={supportPending}>{supportPending ? '저장 중…' : '지원금 상세 저장'}</Button><FormMessage result={supportState} /></form></DetailSection>}
    {showEvent && <DetailSection title="경조사 상세"><form action={eventAction} className="grid gap-3"><input type="hidden" name="transactionId" value={transaction.id} /><FormField label="행사 유형"><select name="eventType" defaultValue={event?.eventType ?? 'other'} className="px-3"><option value="wedding">결혼</option><option value="condolence">조의</option><option value="gift">선물</option><option value="other">기타</option></select></FormField><Field name="counterparty" label="상대방" defaultValue={event?.counterparty ?? ''} /><Field name="relationshipGroup" label="관계" defaultValue={event?.relationshipGroup ?? ''} /><Field name="eventDescription" label="행사 내용" defaultValue={event?.eventDescription ?? ''} /><Button type="submit" variant="secondary" disabled={eventPending}>{eventPending ? '저장 중…' : '경조사 상세 저장'}</Button><FormMessage result={eventState} /></form></DetailSection>}
    {transaction.status === 'planned' && transaction.recurringOccurrenceId && candidates.length > 0 && <DetailSection title="기존 거래와 연결"><form action={linkAction} className="grid gap-3"><input type="hidden" name="occurrenceId" value={transaction.recurringOccurrenceId} /><input type="hidden" name="plannedTransactionId" value={transaction.id} /><select name="postedTransactionId" className="px-3" aria-label="연결할 기존 거래">{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.transactionDate} · {candidate.description}</option>)}</select><Button type="submit" variant="secondary" disabled={linkPending}>{linkPending ? '연결 중…' : '기존 거래와 연결'}</Button><FormMessage result={linkState} /></form></DetailSection>}
    <section className="mt-7 border-t pt-6"><form action={deleteAction} className="flex items-center justify-between gap-3"><input type="hidden" name="id" value={transaction.id} /><p className="text-xs text-[var(--tds-grey-500)]">삭제한 거래는 원장에서 숨겨집니다.</p><Button type="submit" variant="danger" disabled={deletePending}>{deletePending ? '삭제 중…' : '거래 삭제'}</Button></form><FormMessage result={deleteState} /></section>
  </aside></div>;
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-7 border-t pt-6"><h3 className="text-lg font-bold">{title}</h3><div className="mt-3">{children}</div></section>; }
function Field({ name, label, defaultValue, type = 'text', required = false }: { name: string; label: string; defaultValue: string; type?: string; required?: boolean }) { return <FormField label={label} required={required}><input name={name} type={type} defaultValue={defaultValue} required={required} className="px-3" /></FormField>; }
