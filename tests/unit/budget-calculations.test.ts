import { describe, expect, it } from 'vitest';
import { budgetStatus, calculateMonthlyClosing } from '@/lib/budget-calculations';

describe('budgetStatus', () => {
  it('uses the PRD 70, 90, and 100 percent boundaries', () => {
    expect(budgetStatus(69, 100)).toBe('safe');
    expect(budgetStatus(70, 100)).toBe('caution');
    expect(budgetStatus(90, 100)).toBe('near');
    expect(budgetStatus(100, 100)).toBe('over');
  });
  it('treats spending without a budget as over', () => {
    expect(budgetStatus(1, 0)).toBe('over');
    expect(budgetStatus(0, 0)).toBe('safe');
  });
});

describe('calculateMonthlyClosing', () => {
  it('uses posted rows only and excludes non-budget consumption from category spend', () => {
    const result = calculateMonthlyClosing([
      { amount: 3000000, transactionType: 'income', flowClass: 'cash_in', status: 'posted', includeInBudget: true, categoryId: null },
      { amount: 500000, transactionType: 'saving', flowClass: 'saving', status: 'posted', includeInBudget: true, categoryId: 'saving' },
      { amount: 700000, transactionType: 'expense', flowClass: 'consumption', status: 'posted', includeInBudget: true, categoryId: 'food' },
      { amount: 100000, transactionType: 'expense', flowClass: 'consumption', status: 'posted', includeInBudget: false, categoryId: 'food' },
      { amount: 999999, transactionType: 'expense', flowClass: 'consumption', status: 'planned', includeInBudget: true, categoryId: 'food' },
    ], [{ categoryId: 'food', amount: 1000000 }]);
    expect(result).toMatchObject({ income: 3000000, saving: 500000, consumption: 800000, budgetedConsumption: 700000, balance: 1700000, budgetTotal: 1000000, budgetRemaining: 300000 });
    expect(result.spentByCategory.food).toBe(700000);
    expect(result.savingsRate).toBeCloseTo(1 / 6);
  });
  it('avoids division by zero when there is no income or budget', () => {
    const result = calculateMonthlyClosing([], []);
    expect(result.savingsRate).toBeNull();
    expect(result.consumptionRate).toBeNull();
    expect(result.budgetUsageRate).toBeNull();
  });
});
