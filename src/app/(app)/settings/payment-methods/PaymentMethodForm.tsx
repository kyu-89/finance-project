'use client';
import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { createPaymentMethodAction } from '@/actions/payment-method-actions';
import type { HouseholdMember } from '@/lib/household';

export function PaymentMethodForm({ members }: { members: HouseholdMember[] }) {
  const [state, formAction, pending] = useActionState(createPaymentMethodAction, INITIAL_ACTION_STATE);
  return <form action={formAction} className="tds-card grid gap-4 p-5 md:grid-cols-2">
    <div className="md:col-span-2"><FormMessage result={state} /></div>
    <label className="form-field">결제수단 이름<input name="name" required className="px-3 py-2" placeholder="예: 현대카드 the Red" /></label>
    <label className="form-field">종류<select name="methodType" className="tds-select px-3 py-2"><option value="credit_card">신용카드</option><option value="check_card">체크카드</option><option value="account_transfer">계좌이체</option><option value="cash">현금</option><option value="other">기타</option></select></label>
    <label className="form-field">은행·카드사<input name="providerName" className="px-3 py-2" placeholder="예: 국민은행, 현대카드" /></label>
    <label className="form-field">계좌번호<input name="accountNumber" inputMode="numeric" className="px-3 py-2" placeholder="계좌를 등록할 때만 입력" /></label>
    <label className="form-field">카드번호<input name="cardNumber" inputMode="numeric" maxLength={19} className="px-3 py-2" placeholder="저장 시 끝 4자리만 보관해요" /></label>
    <label className="form-field">유효기간<input name="expiresAt" type="month" className="px-3 py-2" placeholder="유효기간 선택" /></label>
    <label className="form-field">명의자<select name="ownerMemberId" className="tds-select px-3 py-2"><option value="">선택 안 함</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label>
    <p className="text-xs text-[var(--tds-grey-500)] md:col-span-2">카드번호는 보안을 위해 끝 4자리만 저장합니다. 자산·금융 메뉴에서는 잔액, 연회비 등 상세 정보도 관리할 수 있어요.</p>
    <button type="submit" disabled={pending} className="tds-primary-button px-5 md:col-span-2">{pending ? '저장 중…' : '추가'}</button>
  </form>;
}
