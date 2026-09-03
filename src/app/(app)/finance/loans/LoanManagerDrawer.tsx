'use client';
import { useActionState } from 'react';
import { Amount } from '@/components/Amount';
import { AmountInput } from '@/components/AmountInput';
import { AssetItem, AssetMetric } from '@/components/AssetItem';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { AddDrawer } from '@/components/Drawer';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { createLoanAction, endLoanAction } from '@/actions/finance-product-actions';
import { buildAmortizationSchedule, findCurrentSnapshot, paymentMonthsInclusive, summarizeLoan } from '@/lib/loan-calculations';
import type { Loan } from '@/lib/loans';
const won = new Intl.NumberFormat('ko-KR');
const methodName = { equal_payment: '원리금균등', equal_principal: '원금균등', bullet: '만기일시' };
export function LoanManagerDrawer({ loans, today }: { loans: Loan[]; today?: string }) { return <div className="flex flex-col gap-5"><p className="rounded-xl bg-[var(--tds-blue-50)] p-4 text-sm">대출을 추가하면 상환표의 원금과 이자가 서로 다른 월간 예정거래로 자동 연결돼요.</p><div className="flex justify-end"><AddDrawer title="대출 추가" description="대출 원금과 상환 조건을 등록합니다." triggerLabel="대출 추가"><LoanForm /></AddDrawer></div><div className="grid gap-4">{loans.length === 0 ? <Empty /> : loans.map((loan) => <LoanRow key={loan.id} loan={loan} today={today ?? new Date().toISOString().slice(0, 10)} />)}</div></div>; }
function LoanForm() { const [state, action, pending] = useActionState(createLoanAction, INITIAL_ACTION_STATE); return <form action={action} className="grid gap-4 md:grid-cols-2"><FormMessage result={state} /><Field label="금융기관"><input name="institutionName" required placeholder="은행 또는 금융사" /></Field><Field label="대출명"><input name="loanName" required placeholder="대출 이름" /></Field><Field label="최초 대출금"><AmountInput name="originalAmount" required placeholder="0" /></Field><Field label="연이율 (%)"><input name="annualRate" type="number" min="0" max="100" step="0.0001" required placeholder="0" /></Field><Field label="상환방법"><select name="repaymentMethod"><option value="equal_payment">원리금균등</option><option value="equal_principal">원금균등</option><option value="bullet">만기일시</option></select></Field><Field label="대출일"><input name="loanDate" type="date" required /></Field><Field label="첫 상환일"><input name="firstPaymentDate" type="date" required /></Field><Field label="만기일"><input name="maturityDate" type="date" required /></Field><Field label="거치기간 (개월)"><input name="graceMonths" type="number" min="0" defaultValue="0" required /></Field><Field label="비고"><input name="memo" placeholder="메모 (선택)" /></Field><button disabled={pending} className="tds-primary-button md:col-span-2">{pending ? '저장 중...' : '대출 추가'}</button></form>; }
function LoanRow({ loan, today }: { loan: Loan; today: string }) {
  const [state, action, pending] = useActionState(endLoanAction, INITIAL_ACTION_STATE);
  const schedule = buildAmortizationSchedule({ principal: loan.originalAmount, annualRate: loan.annualRate, termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate), graceMonths: loan.graceMonths, method: loan.repaymentMethod, firstPaymentDate: loan.firstPaymentDate });
  const current = findCurrentSnapshot(schedule, today);
  const summary = summarizeLoan(schedule);
  const active = loan.status === 'active';
  return <AssetItem
    headingLevel={2}
    title={loan.loanName}
    subtitle={`${loan.institutionName} · ${methodName[loan.repaymentMethod]} · 연 ${(loan.annualRate * 100).toFixed(2)}%`}
    statusBadge={<Badge variant={active ? 'positive' : 'neutral'}>{active ? '상환 중' : loan.status === 'paid_off' ? '상환완료' : '대환'}</Badge>}
    primaryLabel="현재대출잔금"
    primaryValue={<Amount value={current?.remainingBalance ?? loan.originalAmount} type="expense" size="medium" />}
    metrics={<>
      <AssetMetric label="최초원금" value={loan.originalAmount} />
      <AssetMetric label="현재누적상환" value={current?.cumulativePayment ?? 0} />
      <AssetMetric label="총이자" value={summary.totalInterest} />
    </>}
    detail={<details><summary className="tds-asset-item-detail-summary">상환표 보기 ({schedule.length}회)</summary><div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[720px] text-right text-sm"><thead><tr><th>회차</th><th>상환일</th><th>납입원금</th><th>이자</th><th>월상환금</th><th>누적</th><th>잔금</th></tr></thead><tbody>{schedule.map((row) => <tr key={row.installment} className="border-t"><td className="p-2">{row.installment}</td><td>{row.paymentDate}</td><td>{won.format(row.principalPayment)}</td><td>{won.format(row.interestPayment)}</td><td>{won.format(row.totalPayment)}</td><td>{won.format(row.cumulativePayment)}</td><td>{won.format(row.remainingBalance)}</td></tr>)}</tbody></table></div></details>}
    dimmed={!active}
    actions={active && <>
      <form action={action} className="grid grid-cols-2 gap-2"><input type="hidden" name="id" value={loan.id} /><Button type="submit" variant="secondary" name="status" value="paid_off" disabled={pending}>상환완료</Button><Button type="submit" variant="danger" name="status" value="refinanced" disabled={pending}>대환 처리</Button></form>
      <FormMessage result={state} />
    </>}
  />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormField label={label}>{children}</FormField>; } function Empty() { return <p className="tds-card p-6 text-sm text-[var(--tds-grey-500)]">등록된 대출이 없습니다.</p>; }
