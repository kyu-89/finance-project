import { describe, expect, it } from 'vitest';
import {
  classifyTermLength,
  monthsBetween,
  calculateDeposit,
} from '@/lib/deposit-calculations';

describe('monthsBetween', () => {
  it('counts whole months between two dates', () => {
    expect(monthsBetween('2026-01-01', '2027-01-01')).toBe(12);
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(0); // not yet a full month
    expect(monthsBetween('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('classifyTermLength', () => {
  // PRD §6.7 keeps Excel's original boundaries verbatim, including the odd 36/37 gap:
  // 37개월 초과 장기 / 36개월 미만 단기 / 그 외 중기.
  it('applies the PRD boundaries exactly', () => {
    expect(classifyTermLength(38)).toBe('long');
    expect(classifyTermLength(35)).toBe('short');
    expect(classifyTermLength(36)).toBe('mid');
    expect(classifyTermLength(37)).toBe('mid');
  });
});

describe('calculateDeposit', () => {
  it('computes 세전/세후 이자 and 예상수령액 (PRD §6.7)', () => {
    // 원금 10,000,000 · 연이율 3.5% · 12개월 · 과세율 15.4%
    const result = calculateDeposit({
      principal: 10_000_000,
      annualRate: 0.035,
      termMonths: 12,
      taxRate: 0.154,
    });
    // 세전 = 10,000,000 × 0.035 × (12/12) = 350,000
    expect(result.pretaxInterest).toBe(350_000);
    // 세후 = 350,000 × (1 - 0.154) = 296,100
    expect(result.aftertaxInterest).toBe(296_100);
    expect(result.maturityAmount).toBe(10_296_100);
  });

  it('prorates by 가입개월/12 for non-annual terms', () => {
    const result = calculateDeposit({
      principal: 10_000_000,
      annualRate: 0.03,
      termMonths: 6,
      taxRate: 0,
    });
    expect(result.pretaxInterest).toBe(150_000); // 10,000,000 × 0.03 × 0.5
  });

  it('rounds to whole 원 (금액은 정수)', () => {
    const result = calculateDeposit({
      principal: 1_000_000,
      annualRate: 0.033,
      termMonths: 7,
      taxRate: 0.154,
    });
    expect(Number.isInteger(result.pretaxInterest)).toBe(true);
    expect(Number.isInteger(result.aftertaxInterest)).toBe(true);
    expect(Number.isInteger(result.maturityAmount)).toBe(true);
  });
});
