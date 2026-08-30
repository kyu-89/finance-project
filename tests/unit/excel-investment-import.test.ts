import { describe, expect, it } from 'vitest';
import { parseInvestmentTradeRows } from '@/lib/excel-investment-import';

describe('parseInvestmentTradeRows', () => {
  it('parses repeated left and right blocks', () => {
    const rows = [['거래일자', '코인', '종류', '거래단가', '거래금액', '수수료', '정산금액', '', '거래일자', '코인', '종류', '거래단가', '거래금액', '수수료', '정산금액'], ['2026-01-02', '비트코인', '매수', 38000000, 9000, 4.5, 9004.5, '', '2026-01-03', '비트코인', '매도', 39000000, 10000, 5, 9995]];
    const result = parseInvestmentTradeRows(rows);
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.tradeType)).toEqual(['buy', 'sell']);
    expect(result[0]).toMatchObject({ tradeDate: '2026-01-02', assetName: '비트코인', tradeAmount: 9000, fee: 5, settledAmount: 9005 });
  });
  it('keeps malformed rows with validation errors', () => {
    const result = parseInvestmentTradeRows([['거래일자', '코인', '종류', '거래단가', '거래금액', '수수료', '정산금액'], ['bad', '', 'unknown', '', 0, '', '']]);
    expect(result).toHaveLength(1);
    expect(result[0].errors.length).toBeGreaterThanOrEqual(5);
  });
});
