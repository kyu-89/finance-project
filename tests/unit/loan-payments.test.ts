import { describe, expect, it } from 'vitest';
import { summarizeLoanPayments, type LoanPayment } from '@/lib/loan-payments';

const payment = (overrides: Partial<LoanPayment>): LoanPayment => ({
  id: 'id', loanId: 'loan', installment: 1, paymentDate: '2026-01-10', principalPayment: 300_000,
  interestPayment: 20_000, totalPayment: 320_000, cumulativePayment: 320_000, remainingBalance: 9_700_000,
  paymentType: 'scheduled', memo: null, ...overrides,
});

describe('summarizeLoanPayments', () => {
  it('sums payment components and selects the latest balance', () => {
    const result = summarizeLoanPayments([
      payment({ paymentDate: '2026-02-10', installment: 2, principalPayment: 320_000, interestPayment: 18_000, totalPayment: 338_000, remainingBalance: 9_380_000 }),
      payment({}),
    ]);
    expect(result).toEqual({ principal: 620_000, interest: 38_000, total: 658_000, latestRemainingBalance: 9_380_000 });
  });

  it('returns null when there is no payment history', () => {
    expect(summarizeLoanPayments([]).latestRemainingBalance).toBeNull();
  });
});
