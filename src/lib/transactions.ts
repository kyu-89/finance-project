import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { resolveCostBehavior, type TransactionType } from '@/lib/cost-behavior';

export type Transaction = {
  id: string;
  householdId: string;
  transactionDate: string;
  transactionType: TransactionType;
  flowClass: string;
  costBehavior: 'fixed' | 'variable' | null;
  paymentMethodId: string | null;
  accountId?: string | null;
  incomeGroup?: 'fixed' | 'additional' | null;
  parentTransactionId?: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  payerMemberId: string | null;
  beneficiaryMemberId: string | null;
  amount: number;
  description: string;
  memo: string | null;
  tags?: string[];
  includeInBudget: boolean;
  needsReview: boolean;
  recurringRuleId: string | null;
  recurringOccurrenceId: string | null;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled';
};

// PRD §1.4 — maps transaction_type to the flow_class analysis axis. Kept as a single
// source of truth so no two call sites can disagree on which flow_class a type maps to.
export const FLOW_CLASS_BY_TRANSACTION_TYPE: Record<TransactionType, string> = {
  income: 'cash_in',
  expense: 'consumption',
  saving: 'saving',
  investment: 'investment',
  debt_principal: 'debt_principal',
  finance_cost: 'finance_cost',
  transfer: 'transfer',
  asset_adjustment: 'adjustment',
  refund: 'cash_in',
};

function mapRow(row: {
  id: string; household_id: string; transaction_date: string; transaction_type: string;
  flow_class: string; cost_behavior: string | null; payment_method_id: string | null;
  category_id: string | null; subcategory_id: string | null; account_id: string | null; income_group: string | null; parent_transaction_id: string | null; payer_member_id: string | null;
  beneficiary_member_id: string | null; amount: number; description: string; memo: string | null; tags: string[] | null;
  include_in_budget: boolean; needs_review: boolean; recurring_rule_id: string | null;
  recurring_occurrence_id: string | null; status: string;
}): Transaction {
  return {
    id: row.id,
    householdId: row.household_id,
    transactionDate: row.transaction_date,
    transactionType: row.transaction_type as TransactionType,
    flowClass: row.flow_class,
    costBehavior: row.cost_behavior as 'fixed' | 'variable' | null,
    paymentMethodId: row.payment_method_id,
    accountId: row.account_id,
    incomeGroup: row.income_group as 'fixed' | 'additional' | null,
    parentTransactionId: row.parent_transaction_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    payerMemberId: row.payer_member_id,
    beneficiaryMemberId: row.beneficiary_member_id,
    amount: row.amount,
    description: row.description,
    memo: row.memo,
    tags: row.tags ?? [],
    includeInBudget: row.include_in_budget,
    needsReview: row.needs_review,
    recurringRuleId: row.recurring_rule_id,
    recurringOccurrenceId: row.recurring_occurrence_id,
    status: row.status as Transaction['status'],
  };
}

// A single non-interpolated template literal (not string concatenation) so TypeScript infers
// this as a literal string type, not a widened `string` — Supabase's `.select()` overloads
// parse the select-string type at compile time to produce the typed row shape, and a widened
// `string` makes that parse fail with a generic, untyped `GenericStringError` result.
const TRANSACTION_COLUMNS = `id, household_id, transaction_date, transaction_type, flow_class, cost_behavior, payment_method_id, account_id, income_group, parent_transaction_id, category_id, subcategory_id, payer_member_id, beneficiary_member_id, amount, description, memo, tags, include_in_budget, needs_review, recurring_rule_id, recurring_occurrence_id, status`;

export async function createTransaction(input: {
  householdId: string;
  transactionDate: string;
  transactionType: TransactionType;
  categoryId: string | null;
  categoryDefaultCostBehavior: 'fixed' | 'variable' | null;
  costBehaviorOverride?: 'fixed' | 'variable' | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  accountId?: string | null;
  incomeGroup?: 'fixed' | 'additional' | null;
  parentTransactionId?: string | null;
  amount: number;
  description: string;
  memo?: string | null;
  tags?: string[];
  payerMemberId?: string | null;
  beneficiaryMemberId?: string | null;
  needsReview?: boolean;
}): Promise<Transaction> {
  if (input.amount <= 0) {
    throw new Error('금액은 0보다 커야 합니다.');
  }

  const supabase = await createClient();
  const costBehavior = resolveCostBehavior(
    input.transactionType,
    input.categoryDefaultCostBehavior,
    input.costBehaviorOverride ?? null,
  );

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      household_id: input.householdId,
      transaction_date: input.transactionDate,
      transaction_type: input.transactionType,
      flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[input.transactionType],
      cost_behavior: costBehavior,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      payment_method_id: input.paymentMethodId,
      account_id: input.accountId ?? null,
      income_group: input.incomeGroup ?? null,
      parent_transaction_id: input.parentTransactionId ?? null,
      payer_member_id: input.payerMemberId ?? null,
      beneficiary_member_id: input.beneficiaryMemberId ?? null,
      amount: input.amount,
      description: input.description,
      memo: input.memo ?? null,
      tags: input.tags ?? [],
      needs_review: input.needsReview ?? false,
      status: 'posted',
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) {
    throw new Error(`거래 생성 실패: ${error.message}`);
  }

  return mapRow(data);
}

export type ImportedTransactionInput = {
  transactionDate: string;
  transactionType: 'income' | 'expense' | 'refund';
  amount: number;
  description: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  paymentMethodId: string;
  memo?: string | null;
  needsReview?: boolean;
};

export type ImportTransactionsResult = { insertedCount: number; duplicateCount: number };

function importDuplicateKey(row: { transactionDate: string; transactionType: ImportedTransactionInput['transactionType']; amount: number; description: string; paymentMethodId: string | null }): string {
  return `${row.transactionDate}|${row.transactionType}|${row.amount}|${row.description.trim().toLocaleLowerCase()}|${row.paymentMethodId ?? ''}`;
}


// Imports are intentionally a single transaction-like insert from the authenticated user's
// Supabase client. Exact duplicates in the same household/card/date/amount/description are
// skipped, both against existing rows and within the uploaded file, so retrying an import is safe.
export async function importTransactions(input: { householdId: string; rows: ImportedTransactionInput[] }): Promise<ImportTransactionsResult> {
  if (input.rows.length === 0) return { insertedCount: 0, duplicateCount: 0 };
  // Browser mapping controls may submit an empty option as "". PostgreSQL UUID
  // columns accept NULL for an unmapped category/payment method, but reject "".
  // Normalize at the server boundary so every importer has the same safe behavior.
  const rows = input.rows.map((row) => ({
    ...row,
    categoryId: row.categoryId?.trim() || null,
    paymentMethodId: row.paymentMethodId?.trim() || null,
    description: row.description.trim(),
  }));
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.transactionDate) || !Number.isSafeInteger(row.amount) || row.amount <= 0 || !row.description.trim() || (row.transactionType !== 'income' && !row.paymentMethodId)) {
      throw new Error('가져올 거래에 날짜·금액·내용·결제수단이 모두 필요해요.');
    }
  }
  const dates = rows.map((row) => row.transactionDate).sort();
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from('transactions')
    .select('transaction_date, transaction_type, amount, description, payment_method_id')
    .eq('household_id', input.householdId).is('deleted_at', null)
    .gte('transaction_date', dates[0]).lte('transaction_date', dates[dates.length - 1]);
  if (existingError) throw new Error(`기존 거래 확인 실패: ${existingError.message}`);
  const keys = new Set((existing ?? []).map((row) => importDuplicateKey({ transactionDate: row.transaction_date, transactionType: row.transaction_type as ImportedTransactionInput['transactionType'], amount: row.amount, description: row.description, paymentMethodId: row.payment_method_id })));
  const rowsToInsert: Record<string, unknown>[] = [];
  let duplicateCount = 0;
  for (const row of rows) {
    const key = importDuplicateKey({ transactionDate: row.transactionDate, transactionType: row.transactionType, amount: row.amount, description: row.description, paymentMethodId: row.paymentMethodId });
    if (keys.has(key)) { duplicateCount += 1; continue; }
    keys.add(key);
    const costBehavior = row.transactionType === 'expense' ? 'variable' : null;
    rowsToInsert.push({
      household_id: input.householdId,
      transaction_date: row.transactionDate,
      transaction_type: row.transactionType,
      flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[row.transactionType],
      cost_behavior: costBehavior,
      payment_method_id: row.paymentMethodId,
      category_id: row.categoryId ?? null,
      subcategory_id: row.subcategoryId ?? null,
      amount: row.amount,
      description: row.description.trim(),
      memo: row.memo ?? null,
      include_in_budget: row.transactionType === 'expense',
      needs_review: row.needsReview ?? row.transactionType === 'refund',
      status: 'posted',
    });
  }
  if (rowsToInsert.length === 0) return { insertedCount: 0, duplicateCount };
  const { error: insertError } = await supabase.from('transactions').insert(rowsToInsert);
  if (insertError) throw new Error(`거래 가져오기 실패: ${insertError.message}`);
  return { insertedCount: rowsToInsert.length, duplicateCount };
}

export async function listTransactions(filter: {
  householdId: string;
  fromDate?: string;
  toDate?: string;
  categoryId?: string;
  subcategoryId?: string;
  recurringRuleId?: string;
  recurringRuleIds?: string[];
}): Promise<Transaction[]> {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: Parameters<typeof mapRow>[0][] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('transactions').select(TRANSACTION_COLUMNS)
      .eq('household_id', filter.householdId).is('deleted_at', null)
      .order('transaction_date', { ascending: false }).order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (filter.fromDate) query = query.gte('transaction_date', filter.fromDate);
    if (filter.toDate) query = query.lte('transaction_date', filter.toDate);
    if (filter.categoryId) query = query.eq('category_id', filter.categoryId);
    if (filter.subcategoryId) query = query.eq('subcategory_id', filter.subcategoryId);
    if (filter.recurringRuleId) query = query.eq('recurring_rule_id', filter.recurringRuleId);
    if (filter.recurringRuleIds?.length) query = query.in('recurring_rule_id', filter.recurringRuleIds);
    const { data, error } = await query;
    if (error) throw new Error(`거래 목록 조회 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows.map(mapRow);
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const supabase = await createClient();
  // Soft delete only (PRD §5.4) — never a real SQL DELETE. See Task 2's migration note.
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`거래 삭제 실패: ${error.message}`);
  }
}

export type DeletedTransaction = Pick<Transaction, 'id' | 'transactionDate' | 'amount' | 'description' | 'transactionType'> & { deletedAt: string };

export async function listRecentlyDeletedTransactions(householdId: string): Promise<DeletedTransaction[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('transactions')
    .select('id, transaction_date, amount, description, transaction_type, deleted_at')
    .eq('household_id', householdId).not('deleted_at', 'is', null).gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false });
  if (error) throw new Error(`삭제 거래 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, transactionDate: row.transaction_date, amount: row.amount, description: row.description, transactionType: row.transaction_type as Transaction['transactionType'], deletedAt: row.deleted_at }));
}

export async function restoreTransaction(id: string): Promise<void> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('transactions').update({ deleted_at: null })
    .eq('id', id).not('deleted_at', 'is', null).gte('deleted_at', cutoff).select('id');
  if (error) throw new Error(`거래 복구 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('30일 이내 삭제된 거래만 복구할 수 있어요.');
}

export type RecentUsage = {
  categoryIds: string[];
  subcategoryIdsByCategory: Record<string, string[]>;
  paymentMethodIds: string[];
};

// PRD §5.1 속도 정책: 최근 사용 대분류 5개를 상단 노출, 대분류 선택 시 최근 사용 소분류 우선 정렬,
// 최근 결제수단 자동 제안. Derived from the last N posted transactions rather than stored
// separately, so it needs no extra table and can never drift from the actual ledger.
export async function listRecentUsage(householdId: string, limit = 50): Promise<RecentUsage> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, subcategory_id, payment_method_id')
    .eq('household_id', householdId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`최근 사용 내역 조회 실패: ${error.message}`);
  }

  const categoryIds: string[] = [];
  const subcategoryIdsByCategory: Record<string, string[]> = {};
  const paymentMethodIds: string[] = [];

  for (const row of data ?? []) {
    if (row.category_id && !categoryIds.includes(row.category_id)) {
      categoryIds.push(row.category_id);
    }
    if (row.payment_method_id && !paymentMethodIds.includes(row.payment_method_id)) {
      paymentMethodIds.push(row.payment_method_id);
    }
    if (row.category_id && row.subcategory_id) {
      const list = (subcategoryIdsByCategory[row.category_id] ??= []);
      if (!list.includes(row.subcategory_id)) {
        list.push(row.subcategory_id);
      }
    }
  }

  // Only the five most-recent categories move to the top; everything else keeps the
  // configured display order from listCategoriesWithSubcategories (PRD §5.1).
  return { categoryIds: categoryIds.slice(0, 5), subcategoryIdsByCategory, paymentMethodIds };
}

export async function undoTransaction(id: string): Promise<void> {
  // §5.1's 5초 Undo is just a soft delete — the row stays recoverable for 30 days
  // either way (§5.4), so "undo" and "delete" are the same operation here.
  await softDeleteTransaction(id);
}

export async function updateTransactionCostBehavior(
  id: string,
  costBehavior: 'fixed' | 'variable' | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').update({ cost_behavior: costBehavior }).eq('id', id);

  if (error) {
    throw new Error(`비용성격 수정 실패: ${error.message}`);
  }
}

export async function updateTransactionBasics(input: { id: string; transactionDate: string; amount: number; description: string; memo: string | null; tags?: string[] }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').update({ transaction_date: input.transactionDate, amount: input.amount, description: input.description, memo: input.memo, tags: input.tags ?? [] }).eq('id', input.id).is('deleted_at', null).select('id').single();
  if (error) throw new Error(`거래 수정 실패: ${error.message}`);
}

export async function confirmPlannedTransaction(input: {
  id: string;
  transactionDate: string;
  amount: number;
  paymentMethodId: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({
      transaction_date: input.transactionDate,
      amount: input.amount,
      payment_method_id: input.paymentMethodId,
      status: 'posted',
      needs_review: false,
    })
    .eq('id', input.id)
    .eq('status', 'planned')
    .is('deleted_at', null)
    .select('id');

  if (error) throw new Error(`예정 거래 확정 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('확정할 예정 거래를 찾지 못했어요.');
}

export async function skipPlannedTransaction(id: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'skipped' })
    .eq('id', id)
    .eq('status', 'planned')
    .is('deleted_at', null)
    .select('id');

  if (error) throw new Error(`예정 거래 건너뛰기 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('건너뛸 예정 거래를 찾지 못했어요.');
}
