import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { findDuplicateTransactionGroups, type DuplicateTransactionGroup, type DuplicateTransactionRecord } from './duplicate-transactions';

export async function listDuplicateTransactionGroups(householdId: string): Promise<DuplicateTransactionGroup[]> {
  const supabase = await createClient();
  const rows: DuplicateTransactionRecord[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('transactions').select('id, household_id, transaction_date, transaction_type, amount, description, payment_method_id, category_id, subcategory_id, status, source_month, created_at').eq('household_id', householdId).is('deleted_at', null).order('created_at', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`중복 후보 조회 실패: ${error.message}`);
    rows.push(...(data ?? []).map((row) => ({ id: row.id, householdId: row.household_id, transactionDate: row.transaction_date, transactionType: row.transaction_type, amount: row.amount, description: row.description, paymentMethodId: row.payment_method_id, categoryId: row.category_id, subcategoryId: row.subcategory_id, status: row.status, sourceMonth: row.source_month, createdAt: row.created_at })));
    if ((data?.length ?? 0) < 1000) break;
  }
  return findDuplicateTransactionGroups(rows);
}
