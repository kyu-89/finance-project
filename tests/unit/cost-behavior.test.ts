import { describe, expect, it } from 'vitest';
import { resolveCostBehavior } from '@/lib/cost-behavior';

describe('resolveCostBehavior', () => {
  it('returns null for non-expense transaction types regardless of inputs', () => {
    expect(resolveCostBehavior('income', 'fixed', 'variable')).toBeNull();
    expect(resolveCostBehavior('income', null, 'fixed')).toBeNull();
  });

  it('uses the explicit override when provided for an expense', () => {
    expect(resolveCostBehavior('expense', 'variable', 'fixed')).toBe('fixed');
  });

  it("falls back to the category's default_cost_behavior when no override is given", () => {
    expect(resolveCostBehavior('expense', 'fixed', null)).toBe('fixed');
    expect(resolveCostBehavior('expense', 'variable', null)).toBe('variable');
  });

  it('returns null when an expense has no override and no category default (e.g. 저축성지출)', () => {
    expect(resolveCostBehavior('expense', null, null)).toBeNull();
  });
});
