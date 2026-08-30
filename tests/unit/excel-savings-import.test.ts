import { describe, expect, it } from 'vitest';
import { parseDepositRows, parseSavingsRows } from '@/lib/excel-savings-import';

describe('excel savings parsers', () => {
  it('parses deposit rows below summary rows', () => {
    const result = parseDepositRows([['예금관리'], [], ['은행', '예금명', '가입일', '만기일', '원금', '이율', '과세', '비고'], ['신한은행', '정기예금', '2026-01-01', '2027-01-01', '1,000,000', '3.5%', '15.4%', '정미']]);
    expect(result[0]).toMatchObject({ bankName: '신한은행', principal: 1000000, annualRate: 0.035, taxRate: 0.154 });
  });
  it('parses savings current balance and monthly amount', () => {
    const result = parseSavingsRows([['은행', '적금명', '가입일', '만기일', '월 적립액', '이율', '과세', '현재저축액'], ['국민은행', '아이적금', '2026-01-01', '2027-01-01', 300000, 0.04, 0.154, 1200000]]);
    expect(result[0]).toMatchObject({ productName: '아이적금', monthlyAmount: 300000, currentSavings: 1200000 });
  });
});
