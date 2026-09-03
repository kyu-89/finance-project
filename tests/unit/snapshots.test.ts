import { describe, expect, it } from 'vitest';
import { currentLoanBalance } from '@/lib/snapshots';

const loan = {
  id: 'loan-1',
  originalAmount: 220_000_000,
  annualRate: 0.035,
  graceMonths: 0,
  repaymentMethod: 'equal_payment' as const,
  firstPaymentDate: '2025-11-30',
  maturityDate: '2065-10-30',
};

describe('currentLoanBalance', () => {
  it('uses the latest posted loan_payments row at or before today when history exists', () => {
    const paymentsByLoan = new Map([[loan.id, [
      { paymentDate: '2025-11-30', installment: 1, remainingBalance: 219_500_000 },
      { paymentDate: '2025-12-30', installment: 2, remainingBalance: 219_000_000 },
      { paymentDate: '2026-01-30', installment: 3, remainingBalance: 218_500_000 },
      // Future-dated rows (projected schedule, not yet actually paid) must not be used.
      { paymentDate: '2026-05-30', installment: 7, remainingBalance: 216_500_000 },
    ]]]);
    expect(currentLoanBalance(loan, paymentsByLoan, '2026-02-01')).toBe(218_500_000);
  });

  it('breaks ties on the same payment_date by the highest installment number', () => {
    const paymentsByLoan = new Map([[loan.id, [
      { paymentDate: '2026-01-30', installment: 3, remainingBalance: 218_500_000 },
      { paymentDate: '2026-01-30', installment: 4, remainingBalance: 218_000_000 },
    ]]]);
    expect(currentLoanBalance(loan, paymentsByLoan, '2026-02-01')).toBe(218_000_000);
  });

  it('reflects an early repayment recorded in loan_payments even if it undercuts the amortization schedule', () => {
    const paymentsByLoan = new Map([[loan.id, [
      { paymentDate: '2026-01-30', installment: 3, remainingBalance: 100_000_000 }, // large early paydown
    ]]]);
    expect(currentLoanBalance(loan, paymentsByLoan, '2026-02-01')).toBe(100_000_000);
  });

  it('falls back to the amortization-schedule projection when no payment history exists yet', () => {
    const paymentsByLoan = new Map<string, { paymentDate: string; installment: number; remainingBalance: number }[]>();
    const balance = currentLoanBalance(loan, paymentsByLoan, '2026-02-01');
    expect(balance).toBeLessThan(loan.originalAmount);
    expect(balance).toBeGreaterThan(0);
  });

  it('ignores payment rows for a different loan', () => {
    const paymentsByLoan = new Map([['other-loan', [{ paymentDate: '2026-01-30', installment: 3, remainingBalance: 1 }]]]);
    const balance = currentLoanBalance(loan, paymentsByLoan, '2026-02-01');
    expect(balance).toBeLessThan(loan.originalAmount); // schedule fallback, not the other loan's row
  });
});
