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

  it('seeds default_cost_behavior per PRD §4.1 worked examples', () => {
    const behaviorByName = new Map(
      DEFAULT_EXPENSE_CATEGORIES.map((c) => [c.name, c.defaultCostBehavior]),
    );

    // 월세/정액 관리비, 보험료, 통신 기본요금 → fixed (PRD §4.1)
    expect(behaviorByName.get('주거비')).toBe('fixed');
    expect(behaviorByName.get('보험비')).toBe('fixed');
    expect(behaviorByName.get('통신비')).toBe('fixed');

    // savings/investment excluded from fixed/variable analysis entirely (PRD §35)
    expect(behaviorByName.get('저축성지출')).toBeNull();

    // everything else defaults to variable
    expect(behaviorByName.get('식비')).toBe('variable');
  });
});
