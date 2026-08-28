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
  categoryId: string | null;
  subcategoryId: string | null;
  payerMemberId: string | null;
  beneficiaryMemberId: string | null;
  amount: number;
  description: string;
  memo: string | null;
  includeInBudget: boolean;
  needsReview: boolean;
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
  category_id: string | null; subcategory_id: string | null; payer_member_id: string | null;
  beneficiary_member_id: string | null; amount: number; description: string; memo: string | null;
  include_in_budget: boolean; needs_review: boolean; status: string;
}): Transaction {
  return {
    id: row.id,
    householdId: row.household_id,
    transactionDate: row.transaction_date,
    transactionType: row.transaction_type as TransactionType,
    flowClass: row.flow_class,
    costBehavior: row.cost_behavior as 'fixed' | 'variable' | null,
    paymentMethodId: row.payment_method_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    payerMemberId: row.payer_member_id,
    beneficiaryMemberId: row.beneficiary_member_id,
    amount: row.amount,
    description: row.description,
    memo: row.memo,
    includeInBudget: row.include_in_budget,
    needsReview: row.needs_review,
    status: row.status as Transaction['status'],
  };
}

// A single non-interpolated template literal (not string concatenation) so TypeScript infers
// this as a literal string type, not a widened `string` — Supabase's `.select()` overloads
// parse the select-string type at compile time to produce the typed row shape, and a widened
// `string` makes that parse fail with a generic, untyped `GenericStringError` result.
const TRANSACTION_COLUMNS = `id, household_id, transaction_date, transaction_type, flow_class, cost_behavior, payment_method_id, category_id, subcategory_id, payer_member_id, beneficiary_member_id, amount, description, memo, include_in_budget, needs_review, status`;

export async function createTransaction(input: {
  householdId: string;
  transactionDate: string;
  transactionType: TransactionType;
  categoryId: string | null;
  categoryDefaultCostBehavior: 'fixed' | 'variable' | null;
  costBehaviorOverride?: 'fixed' | 'variable' | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  amount: number;
  description: string;
  memo?: string | null;
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
      payer_member_id: input.payerMemberId ?? null,
      beneficiary_member_id: input.beneficiaryMemberId ?? null,
      amount: input.amount,
      description: input.description,
      memo: input.memo ?? null,
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

export async function listTransactions(filter: {
  householdId: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Transaction[]> {
  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('household_id', filter.householdId)
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false });

  if (filter.fromDate) {
    query = query.gte('transaction_date', filter.fromDate);
  }
  if (filter.toDate) {
    query = query.lte('transaction_date', filter.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`거래 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
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

  return { categoryIds, subcategoryIdsByCategory, paymentMethodIds };
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
