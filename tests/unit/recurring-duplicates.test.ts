import { describe, expect, it } from 'vitest';
import { findRecurringDuplicateCandidates, type DuplicateCandidateTransaction } from '@/lib/recurring-duplicates';

const base: DuplicateCandidateTransaction = {
  id: 'planned', transactionDate: '2026-08-10', amount: 12900, description: '구독료', status: 'planned',
  categoryId: 'category', subcategoryId: 'subcategory', paymentMethodId: 'card', recurringOccurrenceId: 'occurrence',
};

describe('findRecurringDuplicateCandidates', () => {
  it('finds exact-amount posted rows within three days and ranks matching axes first', () => {
    const result = findRecurringDuplicateCandidates([
      base,
      { ...base, id: 'weak', status: 'posted', transactionDate: '2026-08-10', categoryId: 'other', paymentMethodId: 'other', recurringOccurrenceId: null },
      { ...base, id: 'strong', status: 'posted', transactionDate: '2026-08-12', recurringOccurrenceId: null },
    ]);
    expect(result.planned.map((candidate) => candidate.id)).toEqual(['strong', 'weak']);
  });

  it('ignores different amounts, dates beyond three days, and non-posted rows', () => {
    const result = findRecurringDuplicateCandidates([
      base,
      { ...base, id: 'amount', status: 'posted', amount: 13000, recurringOccurrenceId: null },
      { ...base, id: 'date', status: 'posted', transactionDate: '2026-08-14', recurringOccurrenceId: null },
      { ...base, id: 'skipped', status: 'skipped', recurringOccurrenceId: null },
    ]);
    expect(result.planned).toEqual([]);
  });
});
