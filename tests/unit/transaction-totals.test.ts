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

  it('reports planned rows separately without adding them to confirmed consumption', () => {
    const totals = calculateTransactionTotals([
      { amount: 10_000, flowClass: 'consumption', status: 'planned' },
      { amount: 20_000, flowClass: 'saving', status: 'planned' },
      { amount: 30_000, flowClass: 'consumption', status: 'posted' },
    ]);

    expect(totals).toEqual({ consumptionTotal: 30_000, plannedTotal: 30_000 });
  });
});
