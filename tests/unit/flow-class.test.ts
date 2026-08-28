import { describe, expect, it } from 'vitest';
import { FLOW_CLASS_BY_TRANSACTION_TYPE } from '@/lib/transactions';

// PRD §1.4 / §23.5 / §23.6: 현금이 나갔다고 모두 비용이 아니다. These assertions are the
// guard that keeps 저축/투자/대출원금/이체 out of 소비(consumption) as more code starts
// writing transactions programmatically (Sprint 2's recurring engine).
describe('FLOW_CLASS_BY_TRANSACTION_TYPE', () => {
  it('maps every transaction_type the DB CHECK constraint allows', () => {
    expect(Object.keys(FLOW_CLASS_BY_TRANSACTION_TYPE).sort()).toEqual(
      [
        'asset_adjustment',
        'debt_principal',
        'expense',
        'finance_cost',
        'income',
        'investment',
        'refund',
        'saving',
        'transfer',
      ].sort(),
    );
  });

  it('only ever emits flow_class values the DB CHECK constraint allows', () => {
    const allowed = new Set([
      'cash_in',
      'consumption',
      'saving',
      'investment',
      'debt_principal',
      'finance_cost',
      'transfer',
      'adjustment',
    ]);
    for (const flowClass of Object.values(FLOW_CLASS_BY_TRANSACTION_TYPE)) {
      expect(allowed.has(flowClass)).toBe(true);
    }
  });

  it('classifies only real consumption as consumption (PRD §23.5, §23.6)', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.expense).toBe('consumption');

    // The whole point of the flow_class axis: none of these are 소비.
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.saving).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.investment).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.debt_principal).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.transfer).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.finance_cost).not.toBe('consumption');
  });

  it('keeps 자산형성 components on their own distinct axes (PRD §1.4)', () => {
    // 자산형성액 = 저축 + 투자순유입 + 대출원금상환 — each must stay separable.
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.saving).toBe('saving');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.investment).toBe('investment');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.debt_principal).toBe('debt_principal');
  });

  it('separates 금융비용 from both 소비 and 부채원금', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.finance_cost).toBe('finance_cost');
  });
});
