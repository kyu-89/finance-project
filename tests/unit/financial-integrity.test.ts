import { describe, expect, it } from 'vitest';
import { calculateMonthlyClosing } from '@/lib/budget-calculations';
import { calculateNetWorth } from '@/lib/net-worth';

const tx = (flowClass: string, amount: number, status: 'posted' | 'planned' | 'cancelled' | 'refunded' = 'posted') => ({ amount, flowClass, status, includeInBudget: true, categoryId: 'category' });

// 2026-09: 저축/투자/대출원금상환/금융비용/이체는 더 이상 별도 flow_class가 아니다 — 저축·
// 대출원금·금융비용은 지출의 하위 카테고리(consumption)로, 이체는 애초에 거래로 기록되지
// 않는다. 그래서 이 무결성 테스트는 총수입/소비성지출/현금잔여액만 검증한다.
describe('PRD financial integrity rules', () => {
  it('sums only posted cash_in/consumption rows into income and consumption', () => {
    const result = calculateMonthlyClosing([
      tx('cash_in', 1_000_000), tx('consumption', 300_000), tx('consumption', 100_000), tx('consumption', 250_000), tx('consumption', 50_000),
    ], []);
    expect(result.income).toBe(1_000_000);
    expect(result.consumption).toBe(700_000);
    expect(result.cashRemaining).toBe(300_000);
  });

  it('excludes planned transactions from posted performance', () => {
    const result = calculateMonthlyClosing([tx('cash_in', 1_000_000), tx('consumption', 400_000), tx('consumption', 200_000, 'planned')], []);
    expect(result.income).toBe(1_000_000);
    expect(result.consumption).toBe(400_000);
    expect(result.cashRemaining).toBe(600_000);
  });

  it('excludes cancelled/refunded transactions from every financial KPI', () => {
    const result = calculateMonthlyClosing([tx('cash_in', 500_000), tx('consumption', 200_000, 'cancelled'), tx('consumption', 150_000, 'refunded')], []);
    expect(result.consumption).toBe(0);
    expect(result.cashRemaining).toBe(500_000);
  });

  it('keeps net worth equal to total assets minus debt', () => {
    const result = calculateNetWorth({ cashAssets: 1_000_000, depositAssets: 2_000_000, savingsAssets: 3_000_000, investmentAssets: 4_000_000, nonFinancialAssets: 5_000_000, totalDebt: 6_000_000 });
    expect(result.totalAssets).toBe(15_000_000);
    expect(result.netWorth).toBe(9_000_000);
  });
});
