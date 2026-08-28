import { describe, expect, it } from 'vitest';
import { listOccurrenceDates } from '@/lib/recurrence';

describe('listOccurrenceDates', () => {
  it('clamps a monthly day to each month end without drifting', () => {
    expect(listOccurrenceDates(
      { startDate: '2026-01-31', frequency: 'monthly', intervalCount: 1, dayOfMonth: 31 },
      '2026-01-01',
      '2026-04-30',
    )).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('supports leap-day yearly rules', () => {
    expect(listOccurrenceDates(
      { startDate: '2024-02-29', frequency: 'yearly', intervalCount: 1 },
      '2024-01-01',
      '2028-12-31',
    )).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('honors interval, query range, and rule end date', () => {
    expect(listOccurrenceDates(
      { startDate: '2026-01-05', endDate: '2026-02-10', frequency: 'weekly', intervalCount: 2 },
      '2026-01-15',
      '2026-03-01',
    )).toEqual(['2026-01-19', '2026-02-02']);
  });

  it('treats custom interval_count as a number of days', () => {
    expect(listOccurrenceDates(
      { startDate: '2026-08-01', frequency: 'custom', intervalCount: 10 },
      '2026-08-01',
      '2026-08-31',
    )).toEqual(['2026-08-01', '2026-08-11', '2026-08-21', '2026-08-31']);
  });
});
