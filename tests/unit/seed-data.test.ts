import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SUBCATEGORY_NAMES } from '@/lib/categories';
import { DEFAULT_PAYMENT_METHOD_NAMES } from '@/lib/payment-methods';

describe('seed data', () => {
  // 2026-09(사용자 지시: "용돈지출은 지출 대분류에 용돈지출 소분류에 남편용돈으로 처리해") —
  // PRD §4.3의 14개에 용돈지출(원본 2023년 엑셀엔 있었지만 이 시드 목록엔 빠져 있던 대분류)을
  // 추가해 15개가 됐다.
  it('defines exactly the 15 expense categories, each with at least one subcategory', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(15);
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
