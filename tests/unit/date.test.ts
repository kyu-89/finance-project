import { describe, expect, it } from 'vitest';
import { formatDateInSeoul, monthRangeFromSeoulDateString } from '@/lib/date';

describe('formatDateInSeoul', () => {
  it('rolls over to the next KST day 9 hours before UTC midnight, not at UTC midnight', () => {
    // 2026-09-01T00:30:00Z is 2026-09-01 09:30 KST (UTC+9) — already Sept 1 in Seoul.
    expect(formatDateInSeoul(new Date('2026-09-01T00:30:00Z'))).toBe('2026-09-01');

    // 2026-08-31T16:30:00Z is 2026-09-01 01:30 KST — also Sept 1 in Seoul, even though the UTC
    // calendar date is still Aug 31. A naive `new Date().toISOString().slice(0, 10)` on a
    // TZ=UTC host would wrongly report 2026-08-31 here.
    expect(formatDateInSeoul(new Date('2026-08-31T16:30:00Z'))).toBe('2026-09-01');

    // And just before the KST rollover instant, it must still read as the previous day.
    expect(formatDateInSeoul(new Date('2026-08-31T14:59:00Z'))).toBe('2026-08-31');
  });
});

describe('monthRangeFromSeoulDateString', () => {
  it('computes first/last day for a 31-day month', () => {
    expect(monthRangeFromSeoulDateString('2026-08-15')).toEqual({
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
    });
  });

  it('computes first/last day for a 30-day month', () => {
    expect(monthRangeFromSeoulDateString('2026-09-15')).toEqual({
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
    });
  });

  it('computes first/last day for February in a non-leap year', () => {
    expect(monthRangeFromSeoulDateString('2026-02-10')).toEqual({
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
    });
  });

  it('computes first/last day for February in a leap year', () => {
    expect(monthRangeFromSeoulDateString('2028-02-10')).toEqual({
      fromDate: '2028-02-01',
      toDate: '2028-02-29',
    });
  });
});
