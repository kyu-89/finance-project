import { buildAmortizationSchedule, paymentMonthsInclusive, type LoanRepaymentMethod } from '@/lib/loan-calculations';

export type LoanRecurringSource = {
  id: string;
  originalAmount: number;
  annualRate: number;
  repaymentMethod: LoanRepaymentMethod;
  firstPaymentDate: string;
  maturityDate: string;
  graceMonths: number;
};

export type LoanOccurrenceAmounts = { debtPrincipal: number; financeCost: number };

export function buildLoanOccurrenceAmounts(loan: LoanRecurringSource): Map<string, LoanOccurrenceAmounts> {
  const schedule = buildAmortizationSchedule({
    principal: loan.originalAmount,
    annualRate: loan.annualRate,
    termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate),
    graceMonths: loan.graceMonths,
    method: loan.repaymentMethod,
    firstPaymentDate: loan.firstPaymentDate,
  });
  return new Map(schedule.map((row) => [row.paymentDate, {
    debtPrincipal: row.principalPayment,
    financeCost: row.interestPayment,
  }]));
}
