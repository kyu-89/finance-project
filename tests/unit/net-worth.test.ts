import { describe, expect, it } from 'vitest';
import { calculateNetWorth, calculateNetWorthChange } from '@/lib/net-worth';

describe('calculateNetWorth', () => {
  it('separates financial, non-financial assets and debt', () => {
    const result = calculateNetWorth({ cashAssets: 2_000_000, depositAssets: 10_000_000, savingsAssets: 5_000_000, investmentAssets: 0, nonFinancialAssets: 300_000_000, totalDebt: 120_000_000 });
    expect(result.financialAssets).toBe(17_000_000);
    expect(result.totalAssets).toBe(317_000_000);
    expect(result.netWorth).toBe(197_000_000);
    expect(result.debtRatio).toBeCloseTo(120_000_000 / 197_000_000);
  });
  it.each([0, -1])('returns null debt ratio when net worth is %s or lower', (netWorth) => {
    const totalDebt = 10; const totalAssets = totalDebt + netWorth;
    expect(calculateNetWorth({ cashAssets: totalAssets, depositAssets: 0, savingsAssets: 0, investmentAssets: 0, nonFinancialAssets: 0, totalDebt }).debtRatio).toBeNull();
  });
});

describe('calculateNetWorthChange', () => {
  it('uses previous net worth as the rate denominator', () => expect(calculateNetWorthChange(120, 100)).toEqual({ amount: 20, rate: 0.2 }));
  it('does not divide by zero', () => expect(calculateNetWorthChange(100, 0)).toEqual({ amount: 100, rate: null }));
});
