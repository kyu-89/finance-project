'use client';

import { useActionState } from 'react';
import { closeAccountAction, closeCardAction, createAccountAction, createCardAction, updateAccountBalanceAction } from '@/actions/account-actions';
import { Amount } from '@/components/Amount';
import { AssetItem } from '@/components/AssetItem';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { AddDrawer } from '@/components/Drawer';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Account } from '@/lib/accounts';
import type { Card } from '@/lib/cards';
import type { PaymentMethod } from '@/lib/payment-methods';
import { maskAccountNumber } from '@/lib/mask';

const won = new Intl.NumberFormat('ko-KR');
const accountTypeName = { checking: '입출금', savings: '저축', cma: 'CMA', other: '기타' };
type Props = { accounts: Account[]; cards: Card[]; paymentMethods: PaymentMethod[] };

export function AccountCardManager({ accounts, cards, paymentMethods }: Props) {
  const [accountState, createAccountForm, accountPending] = useActionState(createAccountAction, INITIAL_ACTION_STATE);
  const [cardState, createCardForm, cardPending] = useActionState(createCardAction, INITIAL_ACTION_STATE);
  return <div className="flex flex-col gap-8">
    <section className="flex flex-col gap-4"><Section title="계좌" description="보유 중인 계좌의 현재 잔액을 관리해요."><AddDrawer title="계좌 추가" description="보유 중인 계좌의 정보를 등록하세요." triggerLabel="계좌 추가"><form action={createAccountForm} className="grid gap-4 md:grid-cols-2"><FormMessage result={accountState} /><Field label="은행명"><input name="bankName" required placeholder="예: 신한은행" /></Field><Field label="계좌명"><input name="accountName" required placeholder="예: 생활비 통장" /></Field><Field label="종류"><select name="accountType"><option value="checking">입출금</option><option value="savings">저축</option><option value="cma">CMA</option><option value="other">기타</option></select></Field><Field label="현재 금액"><input name="currentBalance" type="number" step="1" defaultValue="0" required placeholder="0" /></Field><Field label="계좌번호"><input name="accountNumber" inputMode="numeric" placeholder="계좌번호" /></Field><Field label="용도"><input name="purpose" placeholder="예: 생활비" /></Field><Field label="비고"><input name="memo" placeholder="메모 (선택)" /></Field><button disabled={accountPending} className="tds-primary-button md:col-span-2">{accountPending ? '저장 중...' : '계좌 추가'}</button></form></AddDrawer></Section><div className="grid gap-3">{accounts.map((account) => <AccountRow key={account.id} account={account} />)}</div></section>
    <section className="flex flex-col gap-4"><Section title="카드" description="카드의 연회비와 해지 가능일을 관리해요."><AddDrawer title="카드 추가" description="보유 중인 카드의 정보를 등록하세요." triggerLabel="카드 추가"><form action={createCardForm} className="grid gap-4 md:grid-cols-2"><FormMessage result={cardState} /><Field label="카드사"><input name="issuer" required placeholder="예: 삼성카드" /></Field><Field label="카드명"><input name="cardName" required placeholder="예: 삼성 신용카드" /></Field><Field label="유형"><select name="cardType"><option value="credit">신용</option><option value="check">체크</option></select></Field><Field label="연회비"><input name="annualFee" type="number" min="0" step="1" defaultValue="0" required placeholder="0" /></Field><Field label="해지 가능일"><input name="cancellableFrom" type="date" /></Field><Field label="연결 결제수단"><select name="paymentMethodId"><option value="">선택 안 함</option>{paymentMethods.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="혜택"><input name="benefitSummary" placeholder="예: 교통비 10%" /></Field><Field label="비고"><input name="memo" placeholder="메모 (선택)" /></Field><button disabled={cardPending} className="tds-primary-button md:col-span-2">{cardPending ? '저장 중...' : '카드 추가'}</button></form></AddDrawer></Section><div className="grid gap-3 md:grid-cols-2">{cards.map((card) => <CardRow key={card.id} card={card} />)}</div></section>
  </div>;
}
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{description}</p></div><div className="flex justify-end">{children}</div></>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormField label={label}>{children}</FormField>; }
function AccountRow({ account }: { account: Account }) {
  const [balanceState, balanceAction, balancePending] = useActionState(updateAccountBalanceAction, INITIAL_ACTION_STATE);
  const [closeState, closeAction, closePending] = useActionState(closeAccountAction, INITIAL_ACTION_STATE);
  const closed = account.status === 'closed';
  return <AssetItem
    title={account.accountName}
    subtitle={`${account.bankName}${account.accountNumber ? ` · ${maskAccountNumber(account.accountNumber)}` : ''}`}
    statusBadge={<Badge variant={closed ? 'neutral' : 'positive'}>{closed ? '해지' : accountTypeName[account.accountType]}</Badge>}
    primaryLabel="현재 잔액"
    primaryValue={<Amount value={account.currentBalance} size="medium" />}
    dimmed={closed}
    actions={!closed && <>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <form action={balanceAction} className="flex gap-2"><input type="hidden" name="id" value={account.id} /><input name="amount" type="number" step="1" defaultValue={account.currentBalance} required className="min-w-0 flex-1 text-right" placeholder="잔액" /><Button type="submit" variant="secondary" disabled={balancePending}>{balancePending ? '수정 중...' : '잔액 수정'}</Button></form>
        <form action={closeAction}><input type="hidden" name="id" value={account.id} /><ConfirmSubmitButton disabled={closePending} className="tds-button-secondary tds-button-danger w-full" title="계좌를 해지할까요?" description="해지한 계좌는 목록에서 더 이상 사용할 수 없습니다." confirmLabel="계좌 해지">계좌 해지</ConfirmSubmitButton></form>
      </div>
      <FormMessage result={balanceState.ok !== null ? balanceState : closeState} />
    </>}
  />;
}
function CardRow({ card }: { card: Card }) { const [state, action, pending] = useActionState(closeCardAction, INITIAL_ACTION_STATE); const closed = card.status === 'closed'; return <article className={`tds-card min-w-0 flex flex-col gap-3 p-5 ${closed ? 'opacity-60' : ''}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{card.cardName}</h3><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{card.issuer} · {card.cardType === 'credit' ? '신용' : '체크'}</p></div><span className="rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{closed ? '해지' : '사용 중'}</span></div><dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-[var(--tds-grey-500)]">연회비</dt><dd>{won.format(card.annualFee)}원</dd></div><div><dt className="text-[var(--tds-grey-500)]">해지 가능일</dt><dd>{card.cancellableFrom ?? '-'}</dd></div></dl>{card.benefitSummary && <p className="rounded-xl bg-[var(--tds-blue-50)] p-3 text-sm">{card.benefitSummary}</p>}{!closed && <form action={action}><input type="hidden" name="id" value={card.id} /><ConfirmSubmitButton disabled={pending} className="secondary-button w-full text-[var(--tds-red-500)]" title="카드를 해지할까요?" description="해지한 카드는 결제수단으로 사용할 수 없습니다." confirmLabel="카드 해지">카드 해지</ConfirmSubmitButton><FormMessage result={state} /></form>}</article>; }
