import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SUBCATEGORY_NAMES } from '@/lib/categories';
import { DEFAULT_PAYMENT_METHOD_NAMES } from '@/lib/payment-methods';

describe('seed data', () => {
  it('defines exactly the 14 PRD expense categories, each with at least one subcategory', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(14);
    for (const category of DEFAULT_EXPENSE_CATEGORIES) {
      expect(category.subcategoryNames.length).toBeGreaterThan(0);
    }
  });

  it('includes the PRD default income subcategory names', () => {
    expect(DEFAULT_INCOME_SUBCATEGORY_NAMES).toEqual([
      '이월', '급여', '수당', '상여', '투자수익', '이자', '부수익', '처분소득', '기타 수입',
    ]);
  });

  it('seeds 계좌이체 and 현금 as universal default payment methods', () => {
    expect(DEFAULT_PAYMENT_METHOD_NAMES).toEqual(['계좌이체', '현금']);
  });
});
