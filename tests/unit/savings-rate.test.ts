import { describe, expect, it } from 'vitest';
import { calculateSavingsRate, formatSavingsRate } from '@/lib/savings-rate';

describe('savings rate', () => {
  it('uses weighted period totals', () => {
    expect(calculateSavingsRate([
      { income: 100, saving: 10, investment: 0 },
      { income: 900, saving: 90, investment: 0 },
    ])).toBe(0.1);
  });

  it('handles no income and caps invalid over-100% results', () => {
    expect(calculateSavingsRate([{ income: 0, saving: 10, investment: 0 }])).toBe(0);
    expect(calculateSavingsRate([{ income: 100, saving: 150, investment: 0 }])).toBe(1);
  });

  it('formats the value as a percentage', () => {
    expect(formatSavingsRate(0.1234)).toBe('12.3%');
  });
});
