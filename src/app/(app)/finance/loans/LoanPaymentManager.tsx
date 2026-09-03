'use client';
import { useActionState, useMemo, useState } from 'react';
import { AddDrawer } from '@/components/Drawer';
import { AmountInput } from '@/components/AmountInput';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { createLoanPaymentAction } from '@/actions/loan-payment-actions';
import type { Loan } from '@/lib/loans';
import type { LoanPayment } from '@/lib/loan-payments';
const won = new Intl.NumberFormat('ko-KR');

// A bulk-imported loan can carry hundreds of historical payment rows (one
// real account measured 480+ installments) — rendering them all at once
// made this single section 20,000+px tall. Same paging pattern and CSS
// (.monthly-table-pagination) as the monthly ledger table, not a one-off.
const PAGE_SIZE = 50;

export function LoanPaymentManager({ loans, payments, today }: { loans: Loan[]; payments: LoanPayment[]; today: string }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagePayments = useMemo(() => payments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [payments, currentPage]);
  return <section className="tds-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">실제 상환내역</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">예정 상환표와 실제 조기상환·대환·완납 기록을 분리해 관리합니다.</p></div><AddDrawer title="상환내역 추가" description="실제 상환한 원금과 이자를 기록합니다." triggerLabel="상환내역 추가"><PaymentForm loans={loans} today={today} /></AddDrawer></div>{payments.length === 0 ? <p className="mt-5 text-sm text-[var(--tds-grey-500)]">기록된 실제 상환내역이 없습니다.</p> : <><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs text-[var(--tds-grey-500)]"><th className="py-3">상환일</th><th>대출</th><th>구분</th><th className="text-right">원금</th><th className="text-right">이자</th><th className="text-right">잔액</th></tr></thead><tbody>{pagePayments.map((payment) => <tr key={payment.id} className="border-b border-[var(--tds-grey-100)]"><td className="py-3">{payment.paymentDate}</td><td>{loans.find((loan) => loan.id === payment.loanId)?.loanName ?? '알 수 없는 대출'}</td><td>{payment.paymentType === 'early' ? '조기상환' : payment.paymentType === 'refinance' ? '대환' : payment.paymentType === 'payoff' ? '완납' : '정기상환'}</td><td className="text-right tabular-nums">{won.format(payment.principalPayment)}원</td><td className="text-right tabular-nums">{won.format(payment.interestPayment)}원</td><td className="text-right tabular-nums">{won.format(payment.remainingBalance)}원</td></tr>)}</tbody></table></div>{pageCount > 1 && <nav className="monthly-table-pagination" aria-label="실제 상환내역 페이지 이동"><span>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, payments.length)} / {payments.length}건</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => current - 1)}><span className="sr-only">이전 페이지</span>이전</button><strong>{currentPage} / {pageCount}</strong><button type="button" disabled={currentPage === pageCount} onClick={() => setPage((current) => current + 1)}><span className="sr-only">다음 페이지</span>다음</button></div></nav>}</>}</section>;
}
function PaymentForm({ loans, today }: { loans: Loan[]; today: string }) { const [state, action, pending] = useActionState(createLoanPaymentAction, INITIAL_ACTION_STATE); return <form action={action} className="grid gap-4"><FormMessage result={state} /><FormField label="대출" required><select name="loanId" required className="px-3">{loans.map((loan) => <option key={loan.id} value={loan.id}>{loan.loanName}</option>)}</select></FormField><FormField label="상환일" required><input name="paymentDate" type="date" defaultValue={today} required /></FormField><FormField label="회차" required><input name="installment" type="number" min="1" step="1" defaultValue="1" required placeholder="1" /></FormField><FormField label="상환구분"><select name="paymentType" className="px-3"><option value="scheduled">정기상환</option><option value="early">조기상환</option><option value="refinance">대환</option><option value="payoff">완납</option></select></FormField><FormField label="상환원금" required><AmountInput name="principalPayment" required placeholder="0" /></FormField><FormField label="이자" required><AmountInput name="interestPayment" required placeholder="0" /></FormField><FormField label="누적상환액" required><AmountInput name="cumulativePayment" required placeholder="0" /></FormField><FormField label="상환 후 잔액" required><AmountInput name="remainingBalance" required placeholder="0" /></FormField><FormField label="메모"><input name="memo" placeholder="메모 (선택)" /></FormField><button disabled={pending} className="tds-primary-button">{pending ? '저장 중...' : '상환내역 저장'}</button></form>; }
