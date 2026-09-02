'use client';

import { useActionState } from 'react';
import {
  createDepositAction, createSavingsAccountAction, endDepositAction, endSavingsAccountAction,
  updateCurrentSavingsAction,
} from '@/actions/savings-product-actions';
import { AddDrawer } from '@/components/Drawer';
import { FormMessage } from '@/components/FormMessage';
import type { Account } from '@/lib/accounts';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { calculateDeposit, classifyTermLength, monthsBetween } from '@/lib/deposit-calculations';
import type { Deposit } from '@/lib/deposits';
import { calculateSavings } from '@/lib/savings-calculations';
import type { SavingsAccount } from '@/lib/savings';

const won = new Intl.NumberFormat('ko-KR');
const termName = { short: '단기', mid: '중기', long: '장기' };
const statusName = { active: '유지 중', matured: '만기', terminated: '중도해지' };

type Props = { deposits: Deposit[]; savings: SavingsAccount[]; accounts: Account[]; today: string };

export function SavingsProductManager({ deposits, savings, accounts, today }: Props) {
  const [depositState, depositAction, depositPending] = useActionState(createDepositAction, INITIAL_ACTION_STATE);
  const [savingsState, savingsAction, savingsPending] = useActionState(createSavingsAccountAction, INITIAL_ACTION_STATE);
  return <div className="flex flex-col gap-10">
    <section className="flex flex-col gap-4">
      <Heading title="예금" description="거치식 예금의 세전·세후 이자와 만기 수령액을 계산해요." />
      <AddDrawer title="예금 추가" description="예금 정보를 등록하면 만기 예상 금액을 계산해 보여드립니다." triggerLabel="예금 추가"><form action={depositAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Message result={depositState} />
        <Field label="은행"><input name="bankName" required className="px-3" /></Field>
        <Field label="예금명"><input name="productName" required className="px-3" /></Field>
        <Field label="가입일"><input name="joinedAt" type="date" required className="px-3" /></Field>
        <Field label="만기일"><input name="maturityDate" type="date" required className="px-3" /></Field>
        <Field label="원금"><input name="principal" type="number" min="1" step="1" required className="px-3 text-right" /></Field>
        <Field label="연이율(%)"><input name="annualRate" type="number" min="0" max="100" step="0.0001" required className="px-3 text-right" /></Field>
        <Field label="과세율(%)"><input name="taxRate" type="number" min="0" max="100" step="0.0001" defaultValue="15.4" required className="px-3 text-right" /></Field>
        <AccountSelect accounts={accounts} />
        <Field label="비고"><input name="memo" className="px-3" /></Field>
        <button disabled={depositPending} className="tds-primary-button md:col-span-2 xl:col-span-4">{depositPending ? '저장 중...' : '예금 추가'}</button>
      </form></AddDrawer>
      <div className="grid gap-4 xl:grid-cols-2">{deposits.length === 0 && <Empty text="등록한 예금이 없어요." />}{deposits.map((item) => <DepositCard key={item.id} item={item} today={today} />)}</div>
    </section>

    <section className="flex flex-col gap-4">
      <Heading title="적금" description="단리·월복리 계산과 현재 저축액을 함께 관리해요." />
      <AddDrawer title="적금 추가" description="적금 정보를 등록하면 납입 현황과 만기 예상 금액을 관리할 수 있습니다." triggerLabel="적금 추가"><form action={savingsAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Message result={savingsState} />
        <Field label="은행"><input name="bankName" required className="px-3" /></Field>
        <Field label="적금명"><input name="productName" required className="px-3" /></Field>
        <Field label="가입일"><input name="joinedAt" type="date" required className="px-3" /></Field>
        <Field label="만기일"><input name="maturityDate" type="date" required className="px-3" /></Field>
        <Field label="월 적립액"><input name="monthlyAmount" type="number" min="1" step="1" required className="px-3 text-right" /></Field>
        <Field label="현재 저축액"><input name="currentSavings" type="number" min="0" step="1" defaultValue="0" required className="px-3 text-right" /></Field>
        <Field label="연이율(%)"><input name="annualRate" type="number" min="0" max="100" step="0.0001" required className="px-3 text-right" /></Field>
        <Field label="과세율(%)"><input name="taxRate" type="number" min="0" max="100" step="0.0001" defaultValue="15.4" required className="px-3 text-right" /></Field>
        <Field label="이자 방식"><select name="interestMethod" className="px-3"><option value="simple">단리</option><option value="monthly_compound">월복리</option></select></Field>
        <Field label="월 납부일"><input name="monthlyPaymentDay" type="number" min="1" max="31" step="1" className="px-3" placeholder="25" /></Field>
        <AccountSelect accounts={accounts} />
        <Field label="비고"><input name="memo" className="px-3" /></Field>
        <label className="flex min-h-12 items-center gap-3 rounded-xl bg-[var(--tds-grey-100)] px-4 text-sm font-medium"><input name="autoRecurring" type="checkbox" className="h-5 w-5" />월간 반복납입 사용</label>
        <p className="md:col-span-2 xl:col-span-4 text-xs text-[var(--tds-grey-500)]">반복납입을 켜면 만기 전까지 월간관리에 저축 예정거래가 자동 생성돼요.</p>
        <button disabled={savingsPending} className="tds-primary-button md:col-span-2 xl:col-span-4">{savingsPending ? '저장 중...' : '적금 추가'}</button>
      </form></AddDrawer>
      <div className="grid gap-4 xl:grid-cols-2">{savings.length === 0 && <Empty text="등록한 적금이 없어요." />}{savings.map((item) => <SavingsCard key={item.id} item={item} today={today} />)}</div>
    </section>
  </div>;
}

function Heading({ title, description }: { title: string; description: string }) { return <div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{description}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1 text-sm font-medium">{label}{children}</label>; }
function Message({ result }: { result: typeof INITIAL_ACTION_STATE }) { return <div className="md:col-span-2 xl:col-span-4"><FormMessage result={result} /></div>; }
function AccountSelect({ accounts }: { accounts: Account[] }) { return <Field label="출금 계좌"><select name="withdrawalAccountId" className="px-3"><option value="">지정 안 함</option>{accounts.filter((account) => account.status === 'active').map((account) => <option key={account.id} value={account.id}>{account.bankName} {account.accountName}</option>)}</select></Field>; }
function Empty({ text }: { text: string }) { return <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">{text}</p>; }

function ProductHeader({ name, bank, status }: { name: string; bank: string; status: keyof typeof statusName }) {
  return <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{name}</h3><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{bank}</p></div><span className="rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{statusName[status]}</span></div>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div><dt className="text-xs text-[var(--tds-grey-500)]">{label}</dt><dd className={`mt-1 font-semibold tabular-nums ${accent ? 'text-[var(--tds-blue-500)]' : ''}`}>{value}</dd></div>; }

function EndButtons({ id, action, pending }: { id: string; action: (payload: FormData) => void; pending: boolean }) {
  return <form action={action} className="grid grid-cols-2 gap-2"><input type="hidden" name="id" value={id} /><button name="status" value="matured" disabled={pending} className="secondary-button">만기 처리</button><button name="status" value="terminated" disabled={pending} className="secondary-button text-[var(--tds-red-500)]">중도해지</button></form>;
}

function DepositCard({ item, today }: { item: Deposit; today: string }) {
  const [state, action, pending] = useActionState(endDepositAction, INITIAL_ACTION_STATE);
  const termMonths = monthsBetween(item.joinedAt, item.maturityDate);
  const remainingMonths = today >= item.maturityDate ? 0 : monthsBetween(today, item.maturityDate);
  const result = calculateDeposit({ principal: item.principal, annualRate: item.annualRate, termMonths, taxRate: item.taxRate });
  return <article className={`tds-card flex flex-col gap-4 p-5 ${item.status === 'active' ? '' : 'opacity-65'}`}>
    <ProductHeader name={item.productName} bank={item.bankName} status={item.status} />
    <p className="text-sm text-[var(--tds-grey-700)]">{item.joinedAt} ~ {item.maturityDate} · {termName[classifyTermLength(termMonths)]} {termMonths}개월 · 남은 {remainingMonths}개월</p>
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="원금" value={`${won.format(item.principal)}원`} /><Metric label="세전이자" value={`${won.format(result.pretaxInterest)}원`} /><Metric label="세후이자" value={`${won.format(result.aftertaxInterest)}원`} /><Metric label="예상수령액" value={`${won.format(result.maturityAmount)}원`} accent /></dl>
    {item.status === 'active' && <><EndButtons id={item.id} action={action} pending={pending} /><FormMessage result={state} /></>}
  </article>;
}

function SavingsCard({ item, today }: { item: SavingsAccount; today: string }) {
  const [balanceState, balanceAction, balancePending] = useActionState(updateCurrentSavingsAction, INITIAL_ACTION_STATE);
  const [endState, endAction, endPending] = useActionState(endSavingsAccountAction, INITIAL_ACTION_STATE);
  const termMonths = monthsBetween(item.joinedAt, item.maturityDate);
  const remainingMonths = today >= item.maturityDate ? 0 : monthsBetween(today, item.maturityDate);
  const result = calculateSavings({ monthlyAmount: item.monthlyAmount, annualRate: item.annualRate, termMonths, taxRate: item.taxRate, method: item.interestMethod });
  return <article className={`tds-card flex flex-col gap-4 p-5 ${item.status === 'active' ? '' : 'opacity-65'}`}>
    <ProductHeader name={item.productName} bank={item.bankName} status={item.status} />
    <p className="text-sm text-[var(--tds-grey-700)]">{item.joinedAt} ~ {item.maturityDate} · {termName[classifyTermLength(termMonths)]} {termMonths}개월 · 남은 {remainingMonths}개월</p>
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="만기원금" value={`${won.format(result.maturityPrincipal)}원`} /><Metric label="현재저축액" value={`${won.format(item.currentSavings)}원`} /><Metric label="세후이자" value={`${won.format(result.aftertaxInterest)}원`} /><Metric label="예상수령액" value={`${won.format(result.maturityAmount)}원`} accent /></dl>
    <p className="text-xs text-[var(--tds-grey-500)]">{item.interestMethod === 'simple' ? '단리' : '월복리'} · 연 {(item.annualRate * 100).toFixed(2)}% · {item.autoRecurring ? `반복납입 ${item.monthlyPaymentDay}일` : '반복납입 꺼짐'}</p>
    {item.status === 'active' && <><form action={balanceAction} className="flex gap-2"><input type="hidden" name="id" value={item.id} /><input name="amount" type="number" min="0" step="1" defaultValue={item.currentSavings} className="min-w-0 flex-1 px-3 text-right" /><button disabled={balancePending} className="secondary-button px-4">현재액 수정</button></form><FormMessage result={balanceState} /><EndButtons id={item.id} action={endAction} pending={endPending} /><FormMessage result={endState} /></>}
  </article>;
}
