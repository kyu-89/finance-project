import { describe, expect, it } from 'vitest';
import { FLOW_CLASS_BY_TRANSACTION_TYPE } from '@/lib/transactions';

// 2026-09: 거래 유형이 수입/지출 두 가지로 축소됐다 — 저축/투자/대출원금상환/금융비용/이체/
// 자산조정/환불은 더 이상 별도 transaction_type이 아니다(저축·대출원금·금융비용은 지출의
// 하위 카테고리로, 환불/취소는 status 값으로 표현된다). 그래서 flow_class 축도 cash_in/
// consumption 두 값만 남는다.
describe('FLOW_CLASS_BY_TRANSACTION_TYPE', () => {
  it('maps every transaction_type the DB CHECK constraint allows', () => {
    expect(Object.keys(FLOW_CLASS_BY_TRANSACTION_TYPE).sort()).toEqual(['expense', 'income'].sort());
  });

  it('only ever emits flow_class values the DB CHECK constraint allows', () => {
    const allowed = new Set(['cash_in', 'consumption']);
    for (const flowClass of Object.values(FLOW_CLASS_BY_TRANSACTION_TYPE)) {
      expect(allowed.has(flowClass)).toBe(true);
    }
  });

  it('classifies income as cash_in and expense as consumption', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.income).toBe('cash_in');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.expense).toBe('consumption');
  });
});
