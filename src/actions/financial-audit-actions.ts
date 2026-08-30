'use server';

import { getCurrentHouseholdId } from '@/lib/household';
import { createClient } from '@/lib/supabase/server';

export type FinancialAuditRecord = { name: string; amount: number };
export type FinancialAuditCount = { key: string; count: number; amount: number | null; records: FinancialAuditRecord[] };
const TABLES = [
  ['accounts', '계좌', 'account_name', 'current_balance'], ['deposits', '예금', 'product_name', 'principal'], ['savings_accounts', '적금', 'product_name', 'current_savings'],
  ['loans', '대출', 'loan_name', 'original_amount'], ['insurances', '보험', 'product_name', 'monthly_premium'], ['assets', '기타자산', 'asset_name', 'current_value'],
  ['investment_transactions', '투자거래', 'asset_name', 'settled_amount'],
] as const;

export async function getFinancialAuditCounts(): Promise<FinancialAuditCount[]> {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createClient();
  const result = await Promise.all(TABLES.map(async ([table, key, nameColumn, amountColumn]) => {
    const { data, error } = await supabase.from(table).select(`id,${nameColumn},${amountColumn}`).eq('household_id', householdId);
    if (error) throw new Error(`${key} 대조 조회 실패: ${error.message}`);
    const records = (data ?? []).map((row) => ({ name: String((row as Record<string, unknown>)[nameColumn] ?? '').trim(), amount: Number((row as Record<string, unknown>)[amountColumn] ?? 0) }));
    return { key, count: records.length, amount: records.reduce((sum, row) => sum + row.amount, 0), records };
  }));
  return result;
}
