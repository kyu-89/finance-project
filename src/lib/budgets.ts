import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Budget = {
  id: string;
  year: number;
  month: number;
  transactionType: 'income' | 'expense' | 'saving';
  categoryId: string;
  subcategoryId: string | null;
  amount: number;
};

export type BudgetInput = Omit<Budget, 'id'> & { householdId: string };

export async function listBudgets(householdId: string, year: number): Promise<Budget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('budgets')
    .select('id, year, month, transaction_type, category_id, subcategory_id, amount')
    .eq('household_id', householdId)
    .eq('year', year)
    .order('month');
  if (error) throw new Error(`예산 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    year: row.year,
    month: row.month,
    transactionType: row.transaction_type as Budget['transactionType'],
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    amount: row.amount,
  }));
}

async function upsertBudgets(rows: BudgetInput[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from('budgets').upsert(rows.map((row) => ({
    household_id: row.householdId,
    year: row.year,
    month: row.month,
    transaction_type: row.transactionType,
    category_id: row.categoryId,
    subcategory_id: row.subcategoryId,
    amount: row.amount,
  })), { onConflict: 'household_id,year,month,transaction_type,category_id,subcategory_id' });
  if (error) throw new Error(`예산 저장 실패: ${error.message}`);
}

export async function saveAnnualExpenseBudgets(input: {
  householdId: string;
  year: number;
  values: { categoryId: string; month: number; amount: number }[];
}): Promise<void> {
  await upsertBudgets(input.values.map((value) => ({
    householdId: input.householdId,
    year: input.year,
    month: value.month,
    transactionType: 'expense',
    categoryId: value.categoryId,
    subcategoryId: null,
    amount: value.amount,
  })));
}

export async function copyPreviousYearBudgets(householdId: string, year: number): Promise<void> {
  const previous = await listBudgets(householdId, year - 1);
  await upsertBudgets(previous.map((budget) => ({
    householdId,
    year,
    month: budget.month,
    transactionType: budget.transactionType,
    categoryId: budget.categoryId,
    subcategoryId: budget.subcategoryId,
    amount: budget.amount,
  })));
}

export async function draftBudgetsFromPreviousActuals(householdId: string, year: number): Promise<void> {
  const supabase = await createClient();
  const previousYear = year - 1;
  const { data, error } = await supabase.from('transactions')
    .select('transaction_date, category_id, amount')
    .eq('household_id', householdId)
    .eq('status', 'posted')
    .eq('flow_class', 'consumption')
    .eq('include_in_budget', true)
    .is('deleted_at', null)
    .gte('transaction_date', `${previousYear}-01-01`)
    .lte('transaction_date', `${previousYear}-12-31`);
  if (error) throw new Error(`전년도 실적 조회 실패: ${error.message}`);

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    const month = Number(row.transaction_date.slice(5, 7));
    const key = `${row.category_id}:${month}`;
    totals.set(key, (totals.get(key) ?? 0) + row.amount);
  }
  const { data: categories, error: categoryError } = await supabase.from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('transaction_type', 'expense');
  if (categoryError) throw new Error(`예산 카테고리 조회 실패: ${categoryError.message}`);
  await saveAnnualExpenseBudgets({
    householdId,
    year,
    values: (categories ?? []).flatMap((category) => Array.from({ length: 12 }, (_, index) => ({
      categoryId: category.id,
      month: index + 1,
      amount: totals.get(`${category.id}:${index + 1}`) ?? 0,
    }))),
  });
}
