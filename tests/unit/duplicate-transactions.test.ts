import { describe, expect, it } from 'vitest';
import { findDuplicateTransactionGroups } from '@/lib/duplicate-transactions';

const row = (id: string, createdAt: string, description = '커피') => ({ id, householdId: 'h', transactionDate: '2026-08-02', transactionType: 'expense', amount: 2000, description, paymentMethodId: 'card', categoryId: null, subcategoryId: null, status: 'posted', sourceMonth: null, createdAt });

describe('duplicate transaction review', () => {
  it('keeps the earliest row and lists later exact matches', () => {
    const groups = findDuplicateTransactionGroups([row('b', '2026-08-30T00:00:00Z'), row('a', '2026-08-29T00:00:00Z'), row('c', '2026-08-31T00:00:00Z')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keeper.id).toBe('a');
    expect(groups[0].duplicates.map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('does not merge different payment methods or amounts', () => {
    const groups = findDuplicateTransactionGroups([row('a', '2026-08-29T00:00:00Z'), { ...row('b', '2026-08-30T00:00:00Z'), amount: 3000 }, { ...row('c', '2026-08-30T00:00:00Z'), paymentMethodId: 'cash' }]);
    expect(groups).toHaveLength(0);
  });
});
