import { describe, expect, it } from 'vitest';
import { calculateSavings } from '@/lib/savings-calculations';

describe('calculateSavings - 단리 (simple)', () => {
  it('computes 만기원금 and 세전이자 for the PRD §6.8 worked case', () => {
    // 월 500,000 · 12개월 · 연 3.0% · 과세율 0%
    // 세전이자 = 500,000 × [12×13/2] × (0.03/12) = 500,000 × 78 × 0.0025 = 97,500
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0.03,
      termMonths: 12,
      taxRate: 0,
      method: 'simple',
    });
    expect(result.maturityPrincipal).toBe(6_000_000); // 500,000 × 12
    expect(result.pretaxInterest).toBe(97_500);
    expect(result.aftertaxInterest).toBe(97_500); // taxRate 0 → unchanged
    expect(result.maturityAmount).toBe(6_097_500);
  });

  it('applies 과세율 to get 세후이자 and 예상수령액', () => {
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0.03,
      termMonths: 12,
      taxRate: 0.154,
      method: 'simple',
    });
    expect(result.pretaxInterest).toBe(97_500);
    // 세후 = 97,500 × (1 - 0.154) = 82,485
    expect(result.aftertaxInterest).toBe(82_485);
    expect(result.maturityAmount).toBe(6_082_485); // 6,000,000 + 82,485
  });
});

describe('calculateSavings - 월복리 (monthly compound)', () => {
  it('computes a concrete rounded 세전이자 from the annuity FV formula', () => {
    // 월 500,000 · 60개월 · 연 3.0% · 과세율 0%
    // i = 0.03/12 = 0.0025, n = 60
    // FV = 500,000 × ((1.0025)^60 − 1) / 0.0025 ≈ 32,323,356.3110540956...
    // 세전이자 = FV − 납입원금(30,000,000) ≈ 2,323,356.3110540956 → rounds to 2,323,356
    // (fractional part ≈ .311, nowhere near the .5 boundary)
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0.03,
      termMonths: 60,
      taxRate: 0,
      method: 'monthly_compound',
    });
    expect(result.maturityPrincipal).toBe(30_000_000);
    expect(result.pretaxInterest).toBe(2_323_356);
    expect(result.maturityAmount).toBe(32_323_356);
  });

  it('yields strictly more pretax interest than 단리 for identical inputs (long enough term)', () => {
    // NOTE: this only holds once the term is long enough for compounding to outweigh
    // simple interest's front-loaded holding-period assumption — at 12 months (the §6.8
    // worked case above) 단리 (97,500) is actually LARGER than 월복리 (83,191) under these
    // exact formulas, so the inequality is asserted here with a longer, distinct term
    // instead of silently reusing the worked case.
    const shared = { monthlyAmount: 500_000, annualRate: 0.03, termMonths: 60, taxRate: 0 } as const;
    const simple = calculateSavings({ ...shared, method: 'simple' });
    const compound = calculateSavings({ ...shared, method: 'monthly_compound' });
    expect(compound.pretaxInterest).toBeGreaterThan(simple.pretaxInterest);
  });

  it('does not divide by zero when annualRate is 0 (0% interest → 0 이자, not NaN)', () => {
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0,
      termMonths: 12,
      taxRate: 0,
      method: 'monthly_compound',
    });
    expect(result.pretaxInterest).toBe(0);
    expect(result.aftertaxInterest).toBe(0);
    expect(result.maturityAmount).toBe(6_000_000);
  });
});

describe('calculateSavings - degenerate inputs (both methods)', () => {
  it.each(['simple', 'monthly_compound'] as const)('termMonths = 0 yields a 0 principal, 0 interest result (%s)', (method) => {
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0.03,
      termMonths: 0,
      taxRate: 0.154,
      method,
    });
    expect(result.maturityPrincipal).toBe(0);
    expect(result.pretaxInterest).toBe(0);
    expect(result.aftertaxInterest).toBe(0);
    expect(result.maturityAmount).toBe(0);
  });

  it.each(['simple', 'monthly_compound'] as const)('annualRate = 0 yields 0 interest, not NaN (%s)', (method) => {
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0,
      termMonths: 12,
      taxRate: 0.154,
      method,
    });
    expect(result.pretaxInterest).toBe(0);
    expect(result.aftertaxInterest).toBe(0);
    expect(Number.isNaN(result.pretaxInterest)).toBe(false);
  });

  it.each(['simple', 'monthly_compound'] as const)('taxRate = 0 leaves 세후이자 equal to 세전이자 (%s)', (method) => {
    const result = calculateSavings({
      monthlyAmount: 500_000,
      annualRate: 0.03,
      termMonths: 12,
      taxRate: 0,
      method,
    });
    expect(result.aftertaxInterest).toBe(result.pretaxInterest);
  });
});

describe('calculateSavings - every returned amount is an integer (원 단위)', () => {
  it.each(['simple', 'monthly_compound'] as const)('rounds to whole 원 for a non-round-number case (%s)', (method) => {
    const result = calculateSavings({
      monthlyAmount: 333_333,
      annualRate: 0.0275,
      termMonths: 7,
      taxRate: 0.154,
      method,
    });
    expect(Number.isInteger(result.maturityPrincipal)).toBe(true);
    expect(Number.isInteger(result.pretaxInterest)).toBe(true);
    expect(Number.isInteger(result.aftertaxInterest)).toBe(true);
    expect(Number.isInteger(result.maturityAmount)).toBe(true);
  });
});
