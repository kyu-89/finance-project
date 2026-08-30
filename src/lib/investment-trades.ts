import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { InvestmentTrade } from '@/lib/excel-extended-data';

export type ImportedInvestmentTrade = Omit<InvestmentTrade, 'id'>;

export async function createInvestmentTrade(input: Omit<InvestmentTrade, 'id'> & { householdId: string }) { const supabase = await createClient(); const { error } = await supabase.from('investment_transactions').insert({ household_id: input.householdId, trade_date: input.tradeDate, asset_name: input.assetName, trade_type: input.tradeType, unit_price: input.unitPrice, trade_amount: input.tradeAmount, fee: input.fee, settled_amount: input.settledAmount, memo: input.memo, source: input.source }); if (error) throw new Error(error.message); }
export async function updateInvestmentTrade(id: string, input: Omit<InvestmentTrade, 'id'>) { const supabase = await createClient(); const { error } = await supabase.from('investment_transactions').update({ trade_date: input.tradeDate, asset_name: input.assetName, trade_type: input.tradeType, unit_price: input.unitPrice, trade_amount: input.tradeAmount, fee: input.fee, settled_amount: input.settledAmount, memo: input.memo, source: input.source }).eq('id', id).select('id').single(); if (error) throw new Error(error.message); }
export async function deleteInvestmentTrade(id: string) { const supabase = await createClient(); const { error } = await supabase.from('investment_transactions').delete().eq('id', id); if (error) throw new Error(error.message); }

export async function importInvestmentTrades(input: { householdId: string; trades: ImportedInvestmentTrade[] }) {
  const supabase = await createClient();
  if (input.trades.length === 0) return 0;
  const dates = input.trades.map((trade) => trade.tradeDate).sort();
  const { data: existing, error: existingError } = await supabase.from('investment_transactions').select('trade_date, asset_name, trade_type, unit_price, trade_amount, fee, settled_amount').eq('household_id', input.householdId).gte('trade_date', dates[0]).lte('trade_date', dates[dates.length - 1]);
  if (existingError) throw new Error(existingError.message);
  const key = (trade: { tradeDate: string; assetName: string; tradeType: string; unitPrice: number; tradeAmount: number; fee: number; settledAmount: number }) => `${trade.tradeDate}|${trade.assetName.trim().toLocaleLowerCase()}|${trade.tradeType}|${trade.unitPrice}|${trade.tradeAmount}|${trade.fee}|${trade.settledAmount}`;
  const keys = new Set((existing ?? []).map((trade) => key({ tradeDate: trade.trade_date, assetName: trade.asset_name, tradeType: trade.trade_type, unitPrice: Number(trade.unit_price), tradeAmount: Number(trade.trade_amount), fee: Number(trade.fee), settledAmount: Number(trade.settled_amount) })));
  const rows = input.trades.filter((trade) => { const tradeKey = key(trade); if (keys.has(tradeKey)) return false; keys.add(tradeKey); return true; });
  if (rows.length === 0) return 0;
  const { error } = await supabase.from('investment_transactions').insert(rows.map((trade) => ({ household_id: input.householdId, trade_date: trade.tradeDate, asset_name: trade.assetName, trade_type: trade.tradeType, unit_price: trade.unitPrice, trade_amount: trade.tradeAmount, fee: trade.fee, settled_amount: trade.settledAmount, memo: trade.memo, source: trade.source })));
  if (error) throw new Error(error.message);
  return rows.length;
}
