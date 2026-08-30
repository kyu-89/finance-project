import { describe, expect, it } from 'vitest';
import { findRecurringDuplicateCandidates, type DuplicateCandidateTransaction } from '@/lib/recurring-duplicates';

const base: DuplicateCandidateTransaction = {
  id: 'planned', transactionDate: '2026-08-10', amount: 12900, description: '구독료', status: 'planned',
  categoryId: 'category', subcategoryId: 'subcategory', paymentMethodId: 'card', recurringOccurrenceId: 'occurrence',
};

describe('findRecurringDuplicateCandidates', () => {
  it('also matches planned income occurrences without requiring expense semantics', () => {
    const result = findRecurringDuplicateCandidates([
      { ...base, id: 'support-planned', description: '지원금', transactionDate: '2026-08-20', amount: 300000, categoryId: null, paymentMethodId: null },
      { ...base, id: 'support-posted', status: 'posted', description: '지원금 입금', transactionDate: '2026-08-21', amount: 300000, categoryId: null, paymentMethodId: null },
    ]);
    expect(result['support-planned']).toEqual([{ id: 'support-posted', transactionDate: '2026-08-21', description: '지원금 입금', amount: 300000 }]);
  });
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
