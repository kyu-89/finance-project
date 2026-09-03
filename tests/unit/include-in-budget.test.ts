import { describe, expect, it } from 'vitest';
import { includeInBudget } from '@/lib/transactions';

// 2026-09: createTransaction/updateTransaction/importTransactions 세 경로가 각자 다른 식을
// 인라인으로 써서, 임포트 경로만 'expense'인지만 확인하는 바람에 임포트된 income 행의
// include_in_budget이 잘못 저장되던 결함을 통일한 공유 함수. 세 경로 모두 이 함수 하나만 쓴다.
describe('includeInBudget', () => {
  it('is true for income', () => {
    expect(includeInBudget('income')).toBe(true);
  });

  it('is true for expense', () => {
    expect(includeInBudget('expense')).toBe(true);
  });

  it('is always false for reference transactions, regardless of import vs manual entry', () => {
    expect(includeInBudget('reference')).toBe(false);
  });
});
