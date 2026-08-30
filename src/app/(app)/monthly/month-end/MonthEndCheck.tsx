'use client';

import { useActionState } from 'react';
import { updateAccountBalanceAction } from '@/actions/account-actions';
import { updateCurrentSavingsAction } from '@/actions/savings-product-actions';
import { updateAssetValueAction, saveSnapshotAction } from '@/actions/asset-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Account } from '@/lib/accounts';
import type { Asset } from '@/lib/assets';
import type { Loan } from '@/lib/loans';
import type { SavingsAccount } from '@/lib/savings';
import { buildAmortizationSchedule, findCurrentSnapshot, paymentMonthsInclusive } from '@/lib/loan-calculations';

const won = new Intl.NumberFormat('ko-KR');

export function MonthEndCheck({ accounts, savings, assets, loans, today }: { accounts: Account[]; savings: SavingsAccount[]; assets: Asset[]; loans: Loan[]; today: string }) {
  const activeAccounts = accounts.filter((item) => item.status === 'active');
  const activeSavings = savings.filter((item) => item.status === 'active');
  const activeAssets = assets.filter((item) => item.status === 'active');
  const activeLoans = loans.filter((item) => item.status === 'active');
  const [snapshotState, snapshotAction, snapshotPending] = useActionState(saveSnapshotAction, INITIAL_ACTION_STATE);

  return <div className="flex flex-col gap-5">
    <section className="grid gap-4 md:grid-cols-2">
      <CheckSection title="계좌별 현재잔액" description="은행 앱의 오늘 잔액과 맞춰 주세요.">
        {activeAccounts.length === 0 ? <Empty text="확인할 계좌가 없어요." /> : activeAccounts.map((item) => <AccountCheckRow key={item.id} account={item} />)}
      </CheckSection>
      <CheckSection title="적금 현재저축액" description="납입 내역을 반영한 실제 적립액을 확인해요.">
        {activeSavings.length === 0 ? <Empty text="확인할 적금이 없어요." /> : activeSavings.map((item) => <SavingsCheckRow key={item.id} savings={item} />)}
      </CheckSection>
      <CheckSection title="기타자산 평가액" description="부동산·차량 등 평가액이 바뀐 경우 수정해요.">
        {activeAssets.length === 0 ? <Empty text="확인할 기타자산이 없어요." /> : activeAssets.map((item) => <AssetCheckRow key={item.id} asset={item} />)}
      </CheckSection>
      <CheckSection title="대출 현재잔액" description="상환표 기준으로 계산된 검증값입니다.">
        {activeLoans.length === 0 ? <Empty text="확인할 대출이 없어요." /> : activeLoans.map((item) => <LoanCheckRow key={item.id} loan={item} today={today} />)}
      </CheckSection>
    </section>
    <section className="tds-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-bold">이번 달 점검을 마쳤나요?</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">확인한 현재값을 월별 스냅샷으로 저장해 다음 달 변화와 비교해요.</p></div>
      <form action={snapshotAction} className="flex shrink-0 flex-col gap-1"><button disabled={snapshotPending} className="tds-primary-button px-5">{snapshotPending ? '기록하는 중…' : '자산 스냅샷 저장'}</button><FormMessage result={snapshotState} successMessage="이번 달 자산 현황을 기록했어요." /></form>
    </section>
  </div>;
}

function CheckSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="tds-card p-5"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">{description}</p><div className="mt-4 divide-y divide-[var(--tds-grey-200)]">{children}</div></section>; }
function Empty({ text }: { text: string }) { return <p className="py-4 text-sm text-[var(--tds-grey-500)]">{text}</p>; }
function AccountCheckRow({ account }: { account: Account }) { const [state, action, pending] = useActionState(updateAccountBalanceAction, INITIAL_ACTION_STATE); return <form action={action} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{account.bankName} · {account.accountName}</p><p className="text-xs text-[var(--tds-grey-500)]">현재 {won.format(account.currentBalance)}원</p></div><div className="flex shrink-0 items-center gap-2"><input type="hidden" name="id" value={account.id} /><input name="amount" type="number" step="1" defaultValue={account.currentBalance} aria-label={`${account.accountName} 현재잔액`} className="w-32 px-2 py-2 text-right text-sm" /><button disabled={pending} className="secondary-button px-3 text-xs">{pending ? '저장…' : '저장'}</button></div><FormMessage result={state} /></form>; }
function SavingsCheckRow({ savings }: { savings: SavingsAccount }) { const [state, action, pending] = useActionState(updateCurrentSavingsAction, INITIAL_ACTION_STATE); return <form action={action} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{savings.bankName} · {savings.productName}</p><p className="text-xs text-[var(--tds-grey-500)]">현재 {won.format(savings.currentSavings)}원</p></div><div className="flex shrink-0 items-center gap-2"><input type="hidden" name="id" value={savings.id} /><input name="amount" type="number" min="0" step="1" defaultValue={savings.currentSavings} aria-label={`${savings.productName} 현재저축액`} className="w-32 px-2 py-2 text-right text-sm" /><button disabled={pending} className="secondary-button px-3 text-xs">{pending ? '저장…' : '저장'}</button></div><FormMessage result={state} /></form>; }
function AssetCheckRow({ asset }: { asset: Asset }) { const [state, action, pending] = useActionState(updateAssetValueAction, INITIAL_ACTION_STATE); return <form action={action} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{asset.assetName}</p><p className="text-xs text-[var(--tds-grey-500)]">평가기준일 {asset.valuationDate}</p></div><div className="flex shrink-0 items-center gap-2"><input type="hidden" name="id" value={asset.id} /><input name="value" type="number" min="0" step="1" defaultValue={asset.currentValue} aria-label={`${asset.assetName} 현재 평가액`} className="w-32 px-2 py-2 text-right text-sm" /><button disabled={pending} className="secondary-button px-3 text-xs">{pending ? '저장…' : '저장'}</button></div><FormMessage result={state} /></form>; }
function LoanCheckRow({ loan, today }: { loan: Loan; today: string }) { const schedule = buildAmortizationSchedule({ principal: loan.originalAmount, annualRate: loan.annualRate, termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate), graceMonths: loan.graceMonths, method: loan.repaymentMethod, firstPaymentDate: loan.firstPaymentDate }); const current = findCurrentSnapshot(schedule, today)?.remainingBalance ?? loan.originalAmount; return <div className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{loan.institutionName} · {loan.loanName}</p><p className="text-xs text-[var(--tds-grey-500)]">상환표 기준 · {today}</p></div><strong className="shrink-0 text-sm tabular-nums">{won.format(current)}원</strong></div>; }
