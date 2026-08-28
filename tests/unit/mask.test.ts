import { describe, expect, it } from 'vitest';
import { maskAccountNumber } from '@/lib/mask';

describe('maskAccountNumber', () => {
  it('keeps separators and only the final four digits', () => {
    expect(maskAccountNumber('123-456-789012')).toBe('***-***-**9012');
  });

  it('handles empty and short values', () => {
    expect(maskAccountNumber(null)).toBe('');
    expect(maskAccountNumber('1234')).toBe('1234');
  });

  it('masks a number without separators', () => {
    expect(maskAccountNumber('1234567890')).toBe('******7890');
  });
});
