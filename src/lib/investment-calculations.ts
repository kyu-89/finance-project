import type { InvestmentTrade } from '@/lib/excel-extended-data';

export type InvestmentSummary = { buyAmount: number; sellAmount: number; fees: number; netCashFlow: number };
export type InvestmentAssetSummary = InvestmentSummary & { assetName: string; tradeCount: number };

export function summarizeInvestmentTrades(trades: InvestmentTrade[]): InvestmentSummary {
  const buyAmount = trades.filter((trade) => trade.tradeType === 'buy').reduce((sum, trade) => sum + trade.settledAmount, 0);
  const sellAmount = trades.filter((trade) => trade.tradeType === 'sell').reduce((sum, trade) => sum + trade.settledAmount, 0);
  const fees = trades.reduce((sum, trade) => sum + trade.fee, 0);
  return { buyAmount, sellAmount, fees, netCashFlow: sellAmount - buyAmount };
}

export function summarizeInvestmentByAsset(trades: InvestmentTrade[]): InvestmentAssetSummary[] {
  const groups = new Map<string, InvestmentTrade[]>();
  for (const trade of trades) groups.set(trade.assetName, [...(groups.get(trade.assetName) ?? []), trade]);
  return [...groups.entries()].map(([assetName, assetTrades]) => ({ assetName, tradeCount: assetTrades.length, ...summarizeInvestmentTrades(assetTrades) })).sort((a, b) => Math.abs(b.netCashFlow) - Math.abs(a.netCashFlow));
}
