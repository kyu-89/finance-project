import { describe, expect, it } from 'vitest';
import { buildLoanOccurrenceAmounts } from '@/lib/product-recurring';

describe('loan product recurring amounts', () => {
  it('keeps principal and finance cost as separate monthly flows', () => {
    const amounts = buildLoanOccurrenceAmounts({
      id: 'loan', originalAmount: 10_800_000, annualRate: 0.04,
      repaymentMethod: 'equal_principal', firstPaymentDate: '2026-01-31',
      maturityDate: '2026-12-31', graceMonths: 0,
    });
    expect(amounts.get('2026-01-31')?.debtPrincipal).toBe(900_000);
    expect(amounts.get('2026-01-31')?.financeCost).toBe(36_000);
    expect(amounts.get('2026-02-28')?.debtPrincipal).toBe(900_000);
    expect(amounts.get('2026-02-28')?.financeCost).toBeLessThan(36_000);
  });

  it('emits zero principal during grace without moving it into interest', () => {
    const amounts = buildLoanOccurrenceAmounts({
      id: 'loan', originalAmount: 12_000_000, annualRate: 0.06,
      repaymentMethod: 'equal_payment', firstPaymentDate: '2026-01-10',
      maturityDate: '2026-12-10', graceMonths: 2,
    });
    expect(amounts.get('2026-01-10')).toEqual({ debtPrincipal: 0, financeCost: 60_000 });
    expect(amounts.get('2026-02-10')).toEqual({ debtPrincipal: 0, financeCost: 60_000 });
    expect(amounts.get('2026-03-10')?.debtPrincipal).toBeGreaterThan(0);
  });
});
