import { describe, expect, it } from 'vitest';
import { summarizeInvestmentByAsset, summarizeInvestmentTrades } from '@/lib/investment-calculations';
import type { InvestmentTrade } from '@/lib/excel-extended-data';

const trade = (tradeType: InvestmentTrade['tradeType'], settledAmount: number, fee = 0): InvestmentTrade => ({ id: 'id', tradeDate: '2026-08-01', assetName: '테스트', tradeType, unitPrice: 100, tradeAmount: settledAmount, fee, settledAmount, memo: null, source: null });

describe('summarizeInvestmentTrades', () => {
  it('summarizes buy, sell, fees and net cash flow', () => {
    expect(summarizeInvestmentTrades([trade('buy', 100000, 100), trade('sell', 130000, 130)])).toEqual({ buyAmount: 100000, sellAmount: 130000, fees: 230, netCashFlow: 30000 });
  });
  it('groups the same asset independently', () => {
    expect(summarizeInvestmentByAsset([trade('buy', 100), { ...trade('sell', 80), assetName: '다른 종목' }, trade('sell', 120)]).map((row) => [row.assetName, row.netCashFlow])).toEqual([['다른 종목', 80], ['테스트', 20]]);
  });
});
