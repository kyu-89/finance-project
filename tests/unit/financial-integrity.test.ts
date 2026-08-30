import { describe, expect, it } from 'vitest';
import { calculateMonthlyClosing } from '@/lib/budget-calculations';
import { calculateNetWorth } from '@/lib/net-worth';

const tx = (transactionType: string, flowClass: string, amount: number, status: 'posted' | 'planned' = 'posted') => ({ amount, transactionType, flowClass, status, includeInBudget: true, categoryId: 'category' });

describe('PRD financial integrity rules', () => {
  it('keeps consumption, saving, investment, principal, and finance cost independent', () => {
    const result = calculateMonthlyClosing([
      tx('income', 'cash_in', 1_000_000), tx('expense', 'consumption', 300_000), tx('saving', 'saving', 100_000), tx('investment', 'investment', 200_000), tx('debt_principal', 'debt_principal', 250_000), tx('finance_cost', 'finance_cost', 50_000), tx('transfer', 'transfer', 900_000),
    ], []);
    expect(result.consumption).toBe(300_000);
    expect(result.wealthBuilt).toBe(550_000);
    expect(result.cashOutflow).toBe(900_000);
    expect(result.cashRemaining).toBe(100_000);
    expect(result.livingBalance).toBe(650_000);
  });

  it('excludes planned transactions from posted performance', () => {
    const result = calculateMonthlyClosing([tx('income', 'cash_in', 1_000_000), tx('expense', 'consumption', 400_000), tx('expense', 'consumption', 200_000, 'planned')], []);
    expect(result.income).toBe(1_000_000);
    expect(result.consumption).toBe(400_000);
    expect(result.cashRemaining).toBe(600_000);
  });

  it('excludes transfers from every financial KPI', () => {
    const result = calculateMonthlyClosing([tx('income', 'cash_in', 500_000), tx('transfer', 'transfer', 500_000)], []);
    expect(result.cashOutflow).toBe(0);
    expect(result.wealthBuilt).toBe(0);
    expect(result.cashRemaining).toBe(500_000);
  });

  it('keeps net worth equal to total assets minus debt', () => {
    const result = calculateNetWorth({ cashAssets: 1_000_000, depositAssets: 2_000_000, savingsAssets: 3_000_000, investmentAssets: 4_000_000, nonFinancialAssets: 5_000_000, totalDebt: 6_000_000 });
    expect(result.totalAssets).toBe(15_000_000);
    expect(result.netWorth).toBe(9_000_000);
  });
});
