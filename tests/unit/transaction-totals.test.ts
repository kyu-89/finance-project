import { describe, expect, it } from 'vitest';
import { calculateTransactionTotals } from '@/lib/transaction-totals';

describe('calculateTransactionTotals', () => {
  it('includes only posted consumption rows in the confirmed consumption total', () => {
    const totals = calculateTransactionTotals([
      { amount: 10_000, flowClass: 'consumption', status: 'posted' },
      { amount: 20_000, flowClass: 'saving', status: 'posted' },
      { amount: 30_000, flowClass: 'transfer', status: 'posted' },
      { amount: 40_000, flowClass: 'consumption', status: 'cancelled' },
      { amount: 50_000, flowClass: 'consumption', status: 'skipped' },
    ]);

    expect(totals.consumptionTotal).toBe(10_000);
  });

  it('reports planned consumption separately without adding it to confirmed consumption', () => {
    const totals = calculateTransactionTotals([
      { amount: 10_000, flowClass: 'consumption', status: 'planned' },
      { amount: 20_000, flowClass: 'saving', status: 'planned' },
      { amount: 30_000, flowClass: 'consumption', status: 'posted' },
    ]);

    // This previously expected plannedTotal: 30_000 — it summed the planned 저축 into a figure
    // rendered beside 소비 합계, and so locked in the very bug it looked like it was guarding.
    // 저축 is not 소비 (PRD §23.6); only planned consumption belongs in this total.
    expect(totals).toEqual({ consumptionTotal: 30_000, plannedTotal: 10_000 });
  });

  it('subtracts posted refunds from confirmed consumption', () => {
    const totals = calculateTransactionTotals([
      { amount: 50_000, flowClass: 'consumption', status: 'posted' },
      { amount: 20_000, transactionType: 'refund', flowClass: 'cash_in', status: 'posted' },
    ]);
    expect(totals.consumptionTotal).toBe(30_000);
  });
});

describe('calculateTransactionTotals — planned rows must not mix inflow and outflow', () => {
  it('counts only planned consumption, not planned income', () => {
    const totals = calculateTransactionTotals([
      { amount: 4_000_000, flowClass: 'cash_in', status: 'planned' },
      { amount: 1_000_000, flowClass: 'consumption', status: 'planned' },
      { amount: 500_000, flowClass: 'saving', status: 'planned' },
    ]);
    // Previously 5,500,000 — a salary and a rent added together.
    expect(totals.plannedTotal).toBe(1_000_000);
  });
});
