'use server';

import { getCurrentHouseholdId } from '@/lib/household';
import { createClient } from '@/lib/supabase/server';

export type FinancialAuditCount = { key: string; count: number; amount: number | null };
const TABLES = [
  ['accounts', '계좌', 'current_balance'], ['deposits', '예금', 'principal'], ['savings_accounts', '적금', 'current_savings'],
  ['loans', '대출', 'original_amount'], ['insurances', '보험', 'monthly_premium'], ['assets', '기타자산', 'current_value'],
  ['investment_transactions', '투자거래', 'settled_amount'],
] as const;

export async function getFinancialAuditCounts(): Promise<FinancialAuditCount[]> {
  const householdId = await getCurrentHouseholdId();
  const supabase = await createClient();
  const result = await Promise.all(TABLES.map(async ([table, key, amountColumn]) => {
    const { data, error } = await supabase.from(table).select(`id,${amountColumn}`).eq('household_id', householdId);
    if (error) throw new Error(`${key} 대조 조회 실패: ${error.message}`);
    return { key, count: data?.length ?? 0, amount: data?.reduce((sum, row) => sum + Number((row as Record<string, unknown>)[amountColumn] ?? 0), 0) ?? 0 };
  }));
  return result;
}
