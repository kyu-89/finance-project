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

// 2026-09: 거래 유형이 수입/지출 두 가지로 축소되면서 flow_class도 cash_in/consumption
// 두 값만 남았다 — 저축/투자/대출원금상환/금융비용은 이제 별도 축이 아니라 지출의 하위
// 카테고리이므로 이미 consumption에 포함돼 있고, 환불/취소는 status로만 표현되므로
// status==='posted' 필터가 자동으로 걸러낸다. 그래서 이 테스트는 총수입/소비성지출/
// 현금잔여액 중심으로만 검증한다.
describe('calculateMonthlyClosing', () => {
  it('uses posted rows only and excludes non-budget consumption from category spend', () => {
    const result = calculateMonthlyClosing([
      { amount: 3000000, flowClass: 'cash_in', status: 'posted', includeInBudget: true, categoryId: null },
      { amount: 700000, flowClass: 'consumption', status: 'posted', includeInBudget: true, categoryId: 'food' },
      { amount: 100000, flowClass: 'consumption', status: 'posted', includeInBudget: false, categoryId: 'food' },
      { amount: 999999, flowClass: 'consumption', status: 'planned', includeInBudget: true, categoryId: 'food' },
      { amount: 250000, flowClass: 'consumption', status: 'posted', includeInBudget: true, categoryId: 'housing' },
    ], [
      { transactionType: 'expense', categoryId: 'food', amount: 1000000 },
      { transactionType: 'income', categoryId: 'income', amount: 2800000 },
    ]);
    expect(result).toMatchObject({
      income: 3000000,
      plannedIncome: 2800000,
      incomeVariance: 200000,
      consumption: 1050000,
      budgetedConsumption: 950000,
      cashRemaining: 1950000,
      balance: 1950000,
      budgetTotal: 1000000,
      budgetRemaining: 50000,
    });
    expect(result.spentByCategory.food).toBe(700000);
    expect(result.spentByCategory.housing).toBe(250000);
    expect(result.consumptionRate).toBeCloseTo(1050000 / 3000000);
  });

  it('avoids division by zero when there is no income or budget', () => {
    const result = calculateMonthlyClosing([], []);
    expect(result.consumptionRate).toBeNull();
    expect(result.budgetUsageRate).toBeNull();
    expect(result.income).toBe(0);
    expect(result.consumption).toBe(0);
    expect(result.cashRemaining).toBe(0);
  });

  it('ignores planned rows in every total', () => {
    const result = calculateMonthlyClosing([
      { amount: 1_000_000, flowClass: 'cash_in', status: 'posted', includeInBudget: true, categoryId: null },
      { amount: 400_000, flowClass: 'consumption', status: 'posted', includeInBudget: true, categoryId: 'food' },
      { amount: 200_000, flowClass: 'consumption', status: 'planned', includeInBudget: true, categoryId: 'food' },
    ], []);
    expect(result.consumption).toBe(400_000);
    expect(result.cashRemaining).toBe(600_000);
  });

  it('a refunded/cancelled row (status !== posted) is excluded automatically', () => {
    // 2026-09: 환불/취소는 별도 거래가 아니라 기존 지출 거래의 status 값('refunded'/'cancelled')이다
    // — status==='posted' 필터가 이미 그 거래를 빼주므로 별도의 refund 처리 로직이 필요 없다.
    const result = calculateMonthlyClosing([
      { amount: 500000, flowClass: 'consumption', status: 'posted', includeInBudget: true, categoryId: 'food' },
      { amount: 120000, flowClass: 'consumption', status: 'refunded', includeInBudget: true, categoryId: 'food' },
      { amount: 80000, flowClass: 'consumption', status: 'cancelled', includeInBudget: true, categoryId: 'food' },
    ], []);
    expect(result.consumption).toBe(500000);
    expect(result.spentByCategory.food).toBe(500000);
  });
});
