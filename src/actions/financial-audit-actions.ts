'use server';

import { getCurrentHouseholdId } from '@/lib/household';
import { createClient } from '@/lib/supabase/server';

export type FinancialAuditRecord = { name: string; amount: number; status: string | null };
export type FinancialAuditCount = { key: string; count: number; amount: number | null; records: FinancialAuditRecord[] };
const TABLES = [
  ['accounts', '계좌', 'account_name', 'current_balance', 'status'], ['deposits', '예금', 'product_name', 'principal', 'status'], ['savings_accounts', '적금', 'product_name', 'current_savings', 'status'],
  ['loans', '대출', 'loan_name', 'original_amount', 'status'], ['insurances', '보험', 'product_name', 'monthly_premium', 'status'], ['assets', '기타자산', 'asset_name', 'current_value', 'status'],
  ['investment_transactions', '투자거래', 'asset_name', 'settled_amount', ''],
] as const;

export async function getFinancialAuditCounts(): Promise<FinancialAuditCount[]> {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createClient();
  const result = await Promise.all(TABLES.map(async ([table, key, nameColumn, amountColumn, statusColumn]) => {
    const select = statusColumn ? `id,${nameColumn},${amountColumn},${statusColumn}` : `id,${nameColumn},${amountColumn}`;
    const { data, error } = await supabase.from(table).select(select).eq('household_id', householdId);
    if (error) throw new Error(`${key} 대조 조회 실패: ${error.message}`);
    const records = (data ?? []).map((row) => { const record = row as unknown as Record<string, unknown>; return { name: String(record[nameColumn] ?? '').trim(), amount: Number(record[amountColumn] ?? 0), status: statusColumn ? String(record[statusColumn] ?? '') || null : null }; });
    return { key, count: records.length, amount: records.reduce((sum, row) => sum + row.amount, 0), records };
  }));
  return result;
}
