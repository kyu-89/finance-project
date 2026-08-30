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
    ], [
      { transactionType: 'expense', categoryId: 'food', amount: 1000000 },
      { transactionType: 'income', categoryId: 'income', amount: 2800000 },
      { transactionType: 'saving', categoryId: 'saving', amount: 600000 },
    ]);
    expect(result).toMatchObject({ income: 3000000, plannedIncome: 2800000, incomeVariance: 200000, saving: 500000, savingBudget: 600000, savingVariance: -100000, consumption: 800000, budgetedConsumption: 700000, balance: 1700000, budgetTotal: 1000000, budgetRemaining: 300000 });
    expect(result.spentByCategory.food).toBe(700000);
    expect(result.savingsRate).toBeCloseTo(1 / 6);
    expect(result.targetSavingsRate).toBeCloseTo(600000 / 2800000);
    expect(result.savingsRateVariance).toBeCloseTo((1 / 6) - (600000 / 2800000));
  });
  it('avoids division by zero when there is no income or budget', () => {
    const result = calculateMonthlyClosing([], []);
    expect(result.savingsRate).toBeNull();
    expect(result.targetSavingsRate).toBeNull();
    expect(result.savingsRateVariance).toBeNull();
    expect(result.consumptionRate).toBeNull();
    expect(result.budgetUsageRate).toBeNull();
  });
  it('subtracts linked refunds from consumption and the original budget category', () => {
    const result = calculateMonthlyClosing([
      { amount: 500000, transactionType: 'expense', flowClass: 'consumption', status: 'posted', includeInBudget: true, categoryId: 'food' },
      { amount: 120000, transactionType: 'refund', flowClass: 'cash_in', status: 'posted', includeInBudget: true, categoryId: null, parentCategoryId: 'food' },
    ], []);
    expect(result.consumption).toBe(380000);
    expect(result.spentByCategory.food).toBe(380000);
    expect(result.budgetedConsumption).toBe(380000);
  });
});

describe('calculateMonthlyClosing — 대출·투자·금융비용 (PRD §1.4, §36)', () => {
  // Regression guard for the review finding: the closing screen used to compute
  // balance = income - saving - consumption, silently dropping 투자/대출원금/금융비용.
  // A household with a mortgage was shown 2,500,000원 spare when it actually had 1,300,000원 —
  // an error in the direction that encourages overspending.
  const mortgageHousehold = [
    { amount: 5_000_000, transactionType: 'income', flowClass: 'cash_in', status: 'posted' as const, includeInBudget: true, categoryId: null },
    { amount: 2_000_000, transactionType: 'expense', flowClass: 'consumption', status: 'posted' as const, includeInBudget: true, categoryId: 'cat-food' },
    { amount: 500_000, transactionType: 'saving', flowClass: 'saving', status: 'posted' as const, includeInBudget: false, categoryId: null },
    { amount: 900_000, transactionType: 'debt_principal', flowClass: 'debt_principal', status: 'posted' as const, includeInBudget: false, categoryId: null },
    { amount: 300_000, transactionType: 'finance_cost', flowClass: 'finance_cost', status: 'posted' as const, includeInBudget: false, categoryId: null },
  ];

  it('counts 대출원금상환 and 금융비용 as cash outflow', () => {
    const result = calculateMonthlyClosing(mortgageHousehold, []);
    expect(result.debtPrincipal).toBe(900_000);
    expect(result.financeCost).toBe(300_000);
    // 5,000,000 - (2,000,000 + 300,000 + 500,000 + 900,000)
    expect(result.balance).toBe(1_300_000);
  });

  it('separates 생활수지 / 자산형성액 / 현금잔여액 as distinct KPIs (§36)', () => {
    const result = calculateMonthlyClosing(mortgageHousehold, []);
    expect(result.livingBalance).toBe(2_700_000); // 5,000,000 - 2,000,000 - 300,000
    expect(result.wealthBuilt).toBe(1_400_000); //  500,000 + 900,000 (no investment here)
    expect(result.cashRemaining).toBe(1_300_000);
  });

  it('counts 투자 as 자산형성, never as 소비 (§23.6, §35)', () => {
    const result = calculateMonthlyClosing(
      [
        ...mortgageHousehold,
        { amount: 300_000, transactionType: 'investment', flowClass: 'investment', status: 'posted' as const, includeInBudget: false, categoryId: null },
      ],
      [],
    );
    expect(result.investment).toBe(300_000);
    expect(result.consumption).toBe(2_000_000); // unchanged — 투자 is not 소비
    expect(result.wealthBuilt).toBe(1_700_000);
    expect(result.balance).toBe(1_000_000);
  });

  it('excludes 계좌간 이체 from every total (§23.5)', () => {
    const withTransfer = calculateMonthlyClosing(
      [
        ...mortgageHousehold,
        { amount: 2_000_000, transactionType: 'transfer', flowClass: 'transfer', status: 'posted' as const, includeInBudget: false, categoryId: null },
      ],
      [],
    );
    const withoutTransfer = calculateMonthlyClosing(mortgageHousehold, []);
    expect(withTransfer.balance).toBe(withoutTransfer.balance);
    expect(withTransfer.consumption).toBe(withoutTransfer.consumption);
    expect(withTransfer.wealthBuilt).toBe(withoutTransfer.wealthBuilt);
  });

  it('still ignores planned rows in every new total (§23.9)', () => {
    const result = calculateMonthlyClosing(
      [
        ...mortgageHousehold,
        { amount: 999_000, transactionType: 'debt_principal', flowClass: 'debt_principal', status: 'planned' as const, includeInBudget: false, categoryId: null },
      ],
      [],
    );
    expect(result.debtPrincipal).toBe(900_000);
    expect(result.balance).toBe(1_300_000);
  });
});
