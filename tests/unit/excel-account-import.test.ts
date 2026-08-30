import { describe, expect, it } from 'vitest';
import { parseAccountRows } from '@/lib/excel-account-import';

describe('parseAccountRows', () => {
  it('finds the account table below title rows and preserves account numbers', () => {
    const rows = [['계좌현황'], [], ['No.', '은행', '종류', '계좌명', '계좌번호', '용도', '현재금액', '비고'], [1, '국민은행', '입출금', '생활비', '001-02-123456', '생활', '1,234,000', '주거래']];
    expect(parseAccountRows(rows)).toEqual([expect.objectContaining({ rowNumber: 4, bankName: '국민은행', accountType: 'checking', accountName: '생활비', accountNumber: '001-02-123456', currentBalance: 1234000 })]);
  });
  it('returns validation errors for incomplete rows', () => {
    const result = parseAccountRows([['은행', '계좌명', '현재금액'], ['', '', 'bad']]);
    expect(result[0].errors).toHaveLength(3);
  });
});
