import { describe, expect, it } from 'vitest';
import { FLOW_CLASS_BY_TRANSACTION_TYPE } from '@/lib/transactions';

// 2026-09: 거래 유형이 수입/지출 두 가지로 축소됐다 — 저축/투자/대출원금상환/금융비용/이체/
// 자산조정/환불은 더 이상 별도 transaction_type이 아니다(저축·대출원금·금융비용은 지출의
// 하위 카테고리로, 환불/취소는 status 값으로 표현된다). 그래서 flow_class 축도 cash_in/
// consumption 두 값만 남았다가, 참고 거래(reference) 도입으로 'excluded'가 하나 더 늘었다 —
// cash_in/consumption과 완전히 분리된 값이라 기존 집계(총수입/총지출/월간합계/예산사용액 등)가
// 전부 flow_class 등호 비교만 쓰는 한 코드 변경 없이 자동으로 제외된다.
describe('FLOW_CLASS_BY_TRANSACTION_TYPE', () => {
  it('maps every transaction_type the DB CHECK constraint allows', () => {
    expect(Object.keys(FLOW_CLASS_BY_TRANSACTION_TYPE).sort()).toEqual(['expense', 'income', 'reference'].sort());
  });

  it('only ever emits flow_class values the DB CHECK constraint allows', () => {
    const allowed = new Set(['cash_in', 'consumption', 'excluded']);
    for (const flowClass of Object.values(FLOW_CLASS_BY_TRANSACTION_TYPE)) {
      expect(allowed.has(flowClass)).toBe(true);
    }
  });

  it('classifies income as cash_in and expense as consumption', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.income).toBe('cash_in');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.expense).toBe('consumption');
  });

  it('classifies reference transactions on their own axis, distinct from cash_in/consumption', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.reference).toBe('excluded');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.reference).not.toBe(FLOW_CLASS_BY_TRANSACTION_TYPE.income);
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.reference).not.toBe(FLOW_CLASS_BY_TRANSACTION_TYPE.expense);
  });
});
