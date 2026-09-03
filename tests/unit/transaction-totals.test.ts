import { describe, expect, it } from 'vitest';
import { calculateTransactionTotals } from '@/lib/transaction-totals';

describe('calculateTransactionTotals', () => {
  it('includes only posted consumption rows in the confirmed consumption total', () => {
    const totals = calculateTransactionTotals([
      { amount: 10_000, flowClass: 'consumption', status: 'posted' },
      { amount: 20_000, flowClass: 'cash_in', status: 'posted' },
      { amount: 40_000, flowClass: 'consumption', status: 'cancelled' },
      { amount: 50_000, flowClass: 'consumption', status: 'skipped' },
    ]);

    expect(totals.consumptionTotal).toBe(10_000);
  });

  it('reports planned consumption separately without adding it to confirmed consumption', () => {
    const totals = calculateTransactionTotals([
      { amount: 10_000, flowClass: 'consumption', status: 'planned' },
      { amount: 20_000, flowClass: 'cash_in', status: 'planned' },
      { amount: 30_000, flowClass: 'consumption', status: 'posted' },
    ]);

    // 계획된 수입(cash_in)이 소비 합계에 섞이면 안 된다(PRD §23.6) — 급여와 월세가 더해지는 식의
    // 버그를 막는 회귀 가드.
    expect(totals).toEqual({ consumptionTotal: 30_000, plannedTotal: 10_000 });
  });

  // 2026-09: 환불/취소는 이제 별도 transaction_type이 아니라 그 거래 자체의 status
  // ('refunded'/'cancelled')이다 — status==='posted' 조건에서 이미 완전히 빠지므로
  // "포함 후 빼기"가 아니라 애초에 합산되지 않는다.
  it('excludes a refunded/cancelled row from the confirmed consumption total entirely', () => {
    const totals = calculateTransactionTotals([
      { amount: 50_000, flowClass: 'consumption', status: 'posted' },
      { amount: 20_000, flowClass: 'consumption', status: 'refunded' },
      { amount: 15_000, flowClass: 'consumption', status: 'cancelled' },
    ]);
    expect(totals.consumptionTotal).toBe(50_000);
  });

  // 참고 거래는 posted 상태여도 flow_class가 'excluded'라 소비성지출 합계에 안 잡힌다.
  it('excludes posted reference transactions (flow_class=excluded) from the confirmed consumption total', () => {
    const totals = calculateTransactionTotals([
      { amount: 50_000, flowClass: 'consumption', status: 'posted' },
      { amount: 30_000, flowClass: 'excluded', status: 'posted' },
    ]);
    expect(totals.consumptionTotal).toBe(50_000);
  });
});

describe('calculateTransactionTotals — planned rows must not mix inflow and outflow', () => {
  it('counts only planned consumption, not planned income', () => {
    const totals = calculateTransactionTotals([
      { amount: 4_000_000, flowClass: 'cash_in', status: 'planned' },
      { amount: 1_000_000, flowClass: 'consumption', status: 'planned' },
    ]);
    // Previously 5,000,000 — a salary and a rent added together.
    expect(totals.plannedTotal).toBe(1_000_000);
  });
});
