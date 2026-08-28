'use client';
import { useActionState } from 'react';
import { createLoanAction, endLoanAction } from '@/actions/finance-product-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { HouseholdMember } from '@/lib/household';
import { buildAmortizationSchedule, findCurrentSnapshot, paymentMonthsInclusive, summarizeLoan } from '@/lib/loan-calculations';
import type { Loan } from '@/lib/loans';
const won = new Intl.NumberFormat('ko-KR');
const methodName = { equal_payment: '원리금균등', equal_principal: '원금균등', bullet: '만기일시' };
export function LoanManager({ loans, members, today }: { loans: Loan[]; members: HouseholdMember[]; today: string }) {
  const [state, action, pending] = useActionState(createLoanAction, INITIAL_ACTION_STATE);
  return <div className="flex flex-col gap-5"><p className="rounded-xl bg-[var(--tds-blue-50)] p-4 text-sm">대출을 추가하면 상환표의 원금과 이자가 서로 다른 월간 예정거래로 자동 연결돼요.</p><form action={action} className="tds-card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4"><div className="md:col-span-2 xl:col-span-4"><FormMessage result={state} /></div>
    <Field label="기관명"><input name="institutionName" required className="px-3" /></Field><Field label="대출명"><input name="loanName" required className="px-3" /></Field><Field label="최초 대출금액"><input name="originalAmount" type="number" min="1" step="1" required className="px-3 text-right" /></Field><Field label="연이자율(%)"><input name="annualRate" type="number" min="0" max="100" step="0.0001" required className="px-3 text-right" /></Field>
    <Field label="상환방법"><select name="repaymentMethod" className="px-3"><option value="equal_payment">원리금균등</option><option value="equal_principal">원금균등</option><option value="bullet">만기일시</option></select></Field><Field label="대출일"><input name="loanDate" type="date" required className="px-3" /></Field><Field label="첫 상환일"><input name="firstPaymentDate" type="date" required className="px-3" /></Field><Field label="만기일"><input name="maturityDate" type="date" required className="px-3" /></Field>
    <Field label="거치기간(개월)"><input name="graceMonths" type="number" min="0" step="1" defaultValue="0" required className="px-3" /></Field><Field label="명의자"><select name="ownerMemberId" className="px-3"><option value="">지정 안 함</option>{members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></Field><Field label="비고"><input name="memo" className="px-3" /></Field>
    <button disabled={pending} className="tds-primary-button md:col-span-2 xl:col-span-4">{pending ? '저장 중...' : '대출 추가'}</button></form>
    <div className="grid gap-4">{loans.length === 0 && <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">등록한 대출이 없어요.</p>}{loans.map((loan) => <LoanCard key={loan.id} loan={loan} today={today} />)}</div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1 text-sm font-medium">{label}{children}</label>; }
function LoanCard({ loan, today }: { loan: Loan; today: string }) {
  const [state, action, pending] = useActionState(endLoanAction, INITIAL_ACTION_STATE);
  const schedule = buildAmortizationSchedule({ principal: loan.originalAmount, annualRate: loan.annualRate, termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate), graceMonths: loan.graceMonths, method: loan.repaymentMethod, firstPaymentDate: loan.firstPaymentDate });
  const current = findCurrentSnapshot(schedule, today); const summary = summarizeLoan(schedule); const active = loan.status === 'active';
  return <article className={`tds-card p-5 ${active ? '' : 'opacity-65'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{loan.loanName}</h2><p className="text-sm text-[var(--tds-grey-700)]">{loan.institutionName} · {methodName[loan.repaymentMethod]} · 연 {(loan.annualRate * 100).toFixed(2)}%</p></div><span className="rounded-full bg-[var(--tds-grey-100)] px-2 py-1 text-xs">{active ? '상환 중' : loan.status === 'paid_off' ? '상환완료' : '대환'}</span></div>
    <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4"><Metric label="최초원금" value={loan.originalAmount} /><Metric label="현재대출잔금" value={current?.remainingBalance ?? loan.originalAmount} accent /><Metric label="현재누적상환" value={current?.cumulativePayment ?? 0} /><Metric label="총이자" value={summary.totalInterest} /></dl>
    <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-[var(--tds-blue-500)]">상환표 보기 ({schedule.length}회)</summary><div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[720px] text-right text-sm"><thead><tr><th>회차</th><th>상환일</th><th>납입원금</th><th>이자</th><th>월상환금</th><th>누적</th><th>잔금</th></tr></thead><tbody>{schedule.map((row) => <tr key={row.installment} className="border-t"><td className="p-2">{row.installment}</td><td>{row.paymentDate}</td><td>{won.format(row.principalPayment)}</td><td>{won.format(row.interestPayment)}</td><td>{won.format(row.totalPayment)}</td><td>{won.format(row.cumulativePayment)}</td><td>{won.format(row.remainingBalance)}</td></tr>)}</tbody></table></div></details>
    {active && <><form action={action} className="mt-5 grid grid-cols-2 gap-2"><input type="hidden" name="id" value={loan.id} /><button name="status" value="paid_off" disabled={pending} className="secondary-button">상환완료</button><button name="status" value="refinanced" disabled={pending} className="secondary-button text-[var(--tds-red-500)]">대환 처리</button></form><FormMessage result={state} /></>}
  </article>;
}
function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) { return <div><dt className="text-xs text-[var(--tds-grey-500)]">{label}</dt><dd className={`mt-1 font-bold tabular-nums ${accent ? 'text-[var(--tds-blue-500)]' : ''}`}>{won.format(value)}원</dd></div>; }
