'use server';

import { getCurrentHouseholdId } from '@/lib/household';
import { createClient } from '@/lib/supabase/server';

export async function getAnnualAuditActuals(year: number): Promise<Array<[string, number]>> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('감사 연도를 확인해 주세요.');
  const householdId = await getCurrentHouseholdId();
  const supabase = await createClient();
  const [{ data: categories, error: categoryError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('household_id', householdId),
    supabase.from('transactions').select('category_id, amount').eq('household_id', householdId).eq('status', 'posted').eq('transaction_type', 'expense').gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`).is('deleted_at', null),
  ]);
  if (categoryError) throw new Error(`감사 카테고리 조회 실패: ${categoryError.message}`);
  if (transactionError) throw new Error(`감사 거래 조회 실패: ${transactionError.message}`);
  const nameById = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const totals = new Map<string, number>();
  for (const transaction of transactions ?? []) {
    const name = transaction.category_id ? nameById.get(transaction.category_id) : null;
    const label = name ?? '미분류';
    totals.set(label, (totals.get(label) ?? 0) + Number(transaction.amount));
  }
  return [...totals.entries()];
}
