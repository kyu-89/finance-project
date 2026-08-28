import { describe, expect, it } from 'vitest';
import { buildAmortizationSchedule, findCurrentSnapshot, summarizeLoan } from '@/lib/loan-calculations';

describe('buildAmortizationSchedule', () => {
  it('fully amortizes an equal-payment loan with integer won rows', () => {
    const schedule = buildAmortizationSchedule({
      principal: 100_000_000, annualRate: 0.04, termMonths: 24, graceMonths: 0,
      method: 'equal_payment', firstPaymentDate: '2026-02-28',
    });
    expect(schedule).toHaveLength(24);
    expect(schedule.at(-1)?.remainingBalance).toBe(0);
    expect(schedule.every((row) => row.totalPayment === row.principalPayment + row.interestPayment)).toBe(true);
    expect(schedule.every((row) => Object.values(row).filter((value) => typeof value === 'number').every(Number.isInteger))).toBe(true);
  });

  it('keeps equal principal payments and decreasing interest', () => {
    const schedule = buildAmortizationSchedule({
      principal: 12_000_000, annualRate: 0.06, termMonths: 12, graceMonths: 0,
      method: 'equal_principal', firstPaymentDate: '2026-01-31',
    });
    expect(schedule[0].principalPayment).toBe(1_000_000);
    expect(schedule[10].principalPayment).toBe(1_000_000);
    expect(schedule[0].interestPayment).toBeGreaterThan(schedule[10].interestPayment);
    expect(schedule.at(-1)?.remainingBalance).toBe(0);
    expect(schedule.map((row) => row.paymentDate).slice(0, 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('supports an interest-only grace period before amortization', () => {
    const schedule = buildAmortizationSchedule({
      principal: 10_000_000, annualRate: 0.06, termMonths: 12, graceMonths: 3,
      method: 'equal_payment', firstPaymentDate: '2026-01-15',
    });
    expect(schedule.slice(0, 3).every((row) => row.principalPayment === 0 && row.remainingBalance === 10_000_000)).toBe(true);
    expect(schedule[3].principalPayment).toBeGreaterThan(0);
    expect(schedule.at(-1)?.remainingBalance).toBe(0);
  });

  it('pays bullet principal only in the final installment', () => {
    const schedule = buildAmortizationSchedule({
      principal: 10_000_000, annualRate: 0.03, termMonths: 6, graceMonths: 0,
      method: 'bullet', firstPaymentDate: '2026-01-01',
    });
    expect(schedule.slice(0, -1).every((row) => row.principalPayment === 0)).toBe(true);
    expect(schedule.at(-1)?.principalPayment).toBe(10_000_000);
    expect(schedule.at(-1)?.remainingBalance).toBe(0);
  });

  it('keeps cumulative totals and summary internally consistent', () => {
    const schedule = buildAmortizationSchedule({
      principal: 1_000_000, annualRate: 0, termMonths: 3, graceMonths: 0,
      method: 'equal_payment', firstPaymentDate: '2026-01-01',
    });
    expect(schedule.map((row) => row.cumulativePayment)).toEqual([333_333, 666_666, 1_000_000]);
    expect(summarizeLoan(schedule)).toEqual({ totalInterest: 0, totalPayment: 1_000_000 });
  });
});

describe('findCurrentSnapshot', () => {
  const schedule = buildAmortizationSchedule({
    principal: 1_200_000, annualRate: 0, termMonths: 3, graceMonths: 0,
    method: 'equal_principal', firstPaymentDate: '2026-01-10',
  });

  it('returns null before the first payment', () => expect(findCurrentSnapshot(schedule, '2026-01-09')).toBeNull());
  it('returns the exact payment date row', () => expect(findCurrentSnapshot(schedule, '2026-02-10')?.installment).toBe(2));
  it('returns the latest earlier row between payments', () => expect(findCurrentSnapshot(schedule, '2026-03-01')?.installment).toBe(2));
});
