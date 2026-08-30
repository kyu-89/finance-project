'use client';

import { useActionState } from 'react';
import {
  closeAccountAction, closeCardAction, createAccountAction, createCardAction, updateAccountBalanceAction,
} from '@/actions/account-actions';
import { FormMessage } from '@/components/FormMessage';
import { AddDrawer } from '@/components/Drawer';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Account } from '@/lib/accounts';
import type { Card } from '@/lib/cards';
import type { HouseholdMember } from '@/lib/household';
import type { PaymentMethod } from '@/lib/payment-methods';
import { maskAccountNumber } from '@/lib/mask';

const won = new Intl.NumberFormat('ko-KR');
const accountTypeName = { checking: '입출금', savings: '저축', cma: 'CMA', other: '기타' };

type Props = { accounts: Account[]; cards: Card[]; members: HouseholdMember[]; paymentMethods: PaymentMethod[] };

export function AccountCardManager({ accounts, cards, members, paymentMethods }: Props) {
  const [accountState, createAccountForm, accountPending] = useActionState(createAccountAction, INITIAL_ACTION_STATE);
  const [cardState, createCardForm, cardPending] = useActionState(createCardAction, INITIAL_ACTION_STATE);

  return <div className="flex flex-col gap-8">
    <section className="flex flex-col gap-4">
<div><h2 className="text-xl font-bold">계좌</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">잔액은 실제 통장·카드 앱에서 확인한 금액을 직접 기록해요.</p></div>
      <div className="flex justify-end"><AddDrawer title="계좌 추가" description="보유 중인 계좌의 현재 잔액과 명의자를 등록하세요." triggerLabel="계좌 추가"><form action={createAccountForm} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 xl:col-span-4"><FormMessage result={accountState} /></div>
        <Field label="은행"><input name="bankName" required className="px-3" placeholder="예: 토스뱅크" /></Field>
        <Field label="계좌명"><input name="accountName" required className="px-3" placeholder="월급 계좌" /></Field>
        <Field label="종류"><select name="accountType" className="px-3"><option value="checking">입출금</option><option value="savings">저축</option><option value="cma">CMA</option><option value="other">기타</option></select></Field>
        <Field label="현재 금액"><input name="currentBalance" type="number" step="1" defaultValue="0" required className="px-3 text-right" /></Field>
        <Field label="계좌번호"><input name="accountNumber" inputMode="numeric" className="px-3" placeholder="표시 시 자동 마스킹" /></Field>
        <Field label="용도"><input name="purpose" className="px-3" placeholder="생활비" /></Field>
        <MemberSelect members={members} />
        <Field label="비고"><input name="memo" className="px-3" /></Field>
        <button disabled={accountPending} className="tds-primary-button md:col-span-2 xl:col-span-4">{accountPending ? '저장 중...' : '계좌 추가'}</button>
      </form></AddDrawer></div>
      <div className="grid gap-3">
        {accounts.length === 0 && <Empty text="등록한 계좌가 없어요." />}
        {accounts.map((account) => <AccountRow key={account.id} account={account} />)}
      </div>
    </section>

    <section className="flex flex-col gap-4">
      <div><h2 className="text-xl font-bold">카드</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">연회비와 혜택, 해지 가능일을 함께 관리해요.</p></div>
      <div className="flex justify-end"><AddDrawer title="카드 추가" description="카드 정보를 등록하면 결제수단과 연결할 수 있어요." triggerLabel="카드 추가"><form action={createCardForm} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 xl:col-span-4"><FormMessage result={cardState} /></div>
        <Field label="카드사"><input name="issuer" required className="px-3" /></Field>
        <Field label="카드명"><input name="cardName" required className="px-3" /></Field>
        <Field label="유형"><select name="cardType" className="px-3"><option value="credit">신용</option><option value="check">체크</option></select></Field>
        <Field label="연회비"><input name="annualFee" type="number" min="0" step="1" defaultValue="0" required className="px-3 text-right" /></Field>
        <Field label="발급처"><input name="issuedBy" className="px-3" /></Field>
        <Field label="해지 가능일"><input name="cancellableFrom" type="date" className="px-3" /></Field>
        <MemberSelect members={members} />
        <Field label="연결 결제수단"><select name="paymentMethodId" className="px-3"><option value="">연결 안 함</option>{paymentMethods.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="실질 혜택"><input name="benefitSummary" className="px-3" placeholder="예: 교통비 10%" /></Field>
        <Field label="비고"><input name="memo" className="px-3" /></Field>
        <button disabled={cardPending} className="tds-primary-button md:col-span-2 xl:col-span-4">{cardPending ? '저장 중...' : '카드 추가'}</button>
      </form></AddDrawer></div>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.length === 0 && <Empty text="등록한 카드가 없어요." />}
        {cards.map((card) => <CardRow key={card.id} card={card} />)}
      </div>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium">{label}{children}</label>;
}

function MemberSelect({ members }: { members: HouseholdMember[] }) {
  return <Field label="명의자"><select name="ownerMemberId" className="px-3"><option value="">지정 안 함</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></Field>;
}

function Empty({ text }: { text: string }) { return <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">{text}</p>; }

function AccountRow({ account }: { account: Account }) {
  const [balanceState, balanceAction, balancePending] = useActionState(updateAccountBalanceAction, INITIAL_ACTION_STATE);
  const [closeState, closeAction, closePending] = useActionState(closeAccountAction, INITIAL_ACTION_STATE);
  const closed = account.status === 'closed';
  return <article className={`tds-card p-5 ${closed ? 'opacity-60' : ''}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><h3 className="font-bold">{account.accountName}</h3><span className="rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{closed ? '해지' : accountTypeName[account.accountType]}</span></div><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{account.bankName}{account.accountNumber ? ` · ${maskAccountNumber(account.accountNumber)}` : ''}</p></div>
      <strong className="text-lg tabular-nums">{won.format(account.currentBalance)}원</strong>
    </div>
    {!closed && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
      <form action={balanceAction} className="flex gap-2"><input type="hidden" name="id" value={account.id} /><input name="amount" type="number" step="1" defaultValue={account.currentBalance} required className="min-w-0 flex-1 px-3 text-right" /><button disabled={balancePending} className="secondary-button px-4">{balancePending ? '수정 중' : '잔액 수정'}</button></form>
      <form action={closeAction}><input type="hidden" name="id" value={account.id} /><button disabled={closePending} className="secondary-button w-full px-4 text-[var(--tds-red-500)]">계좌 해지</button></form>
      <div className="md:col-span-2"><FormMessage result={balanceState.ok !== null ? balanceState : closeState} /></div>
    </div>}
  </article>;
}

function CardRow({ card }: { card: Card }) {
  const [state, action, pending] = useActionState(closeCardAction, INITIAL_ACTION_STATE);
  const closed = card.status === 'closed';
  return <article className={`tds-card flex flex-col gap-3 p-5 ${closed ? 'opacity-60' : ''}`}>
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{card.cardName}</h3><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{card.issuer} · {card.cardType === 'credit' ? '신용' : '체크'}</p></div><span className="rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{closed ? '해지' : '사용 중'}</span></div>
    <dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-[var(--tds-grey-500)]">연회비</dt><dd>{won.format(card.annualFee)}원</dd></div><div><dt className="text-[var(--tds-grey-500)]">해지 가능일</dt><dd>{card.cancellableFrom ?? '-'}</dd></div></dl>
    {card.benefitSummary && <p className="rounded-xl bg-[var(--tds-blue-50)] p-3 text-sm">{card.benefitSummary}</p>}
    {!closed && <form action={action}><input type="hidden" name="id" value={card.id} /><button disabled={pending} className="secondary-button w-full text-[var(--tds-red-500)]">카드 해지</button><FormMessage result={state} /></form>}
  </article>;
}
