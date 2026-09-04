import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { resolveCostBehavior, type TransactionType } from '@/lib/cost-behavior';

// 2026-09: 예산 집계는 참고 거래를 항상 제외한다(사용자 지시) — 생성·수정·임포트 세 경로가
// 각자 다른 식을 인라인으로 쓰다가 임포트 경로만 'expense'인지만 확인해 수입 임포트 행의
// include_in_budget이 잘못 저장되는 결함이 있었다. 하나의 함수로 통일해 다시 갈라지지 않게 한다.
export function includeInBudget(transactionType: TransactionType): boolean {
  return transactionType !== 'reference';
}

export type Transaction = {
  id: string;
  householdId: string;
  transactionDate: string;
  sourceMonth?: string | null;
  transactionType: TransactionType;
  flowClass: string;
  costBehavior: 'fixed' | 'variable' | null;
  paymentMethodId: string | null;
  accountId?: string | null;
  incomeGroup?: 'fixed' | 'additional' | null;
  // expense_group은 DB 트리거가 category_id로부터 항상 자동으로 채운다(사용자 지시) — 이
  // 필드는 애플리케이션 코드에서 절대 직접 쓰지 않는다, 읽기 전용으로만 쓴다.
  expenseGroup?: 'savings' | 'consumption' | null;
  parentTransactionId?: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  amount: number;
  description: string;
  memo: string | null;
  tags?: string[];
  includeInBudget: boolean;
  needsReview: boolean;
  recurringRuleId: string | null;
  recurringOccurrenceId: string | null;
  // 2026-09: 환불/취소는 status로 표현한다 — 'cancelled'/'refunded' 둘 다 "지출이 없었던 것으로
  // 친다"는 같은 효과(모든 집계가 status='posted'만 세므로 자동으로 빠짐). 취소=애초에 안 쓴 것으로
  // 처리, 환불=썼다가 돈이 돌아온 것으로 처리 — 의미는 다르지만 집계 관점에서는 동일하게 제외된다.
  status: 'planned' | 'posted' | 'skipped' | 'cancelled' | 'refunded';
};

/** 대시보드·분석 집계에 필요한 최소 거래 표현입니다. */
export type TransactionSummary = Pick<Transaction,
  'id' | 'transactionDate' | 'sourceMonth' | 'transactionType' | 'flowClass' |
  'paymentMethodId' | 'categoryId' | 'subcategoryId' | 'amount' | 'description' | 'status'
>;

// PRD §1.4 — maps transaction_type to the flow_class analysis axis. Kept as a single
// source of truth so no two call sites can disagree on which flow_class a type maps to.
export const FLOW_CLASS_BY_TRANSACTION_TYPE: Record<TransactionType, string> = {
  income: 'cash_in',
  expense: 'consumption',
  reference: 'excluded',
};

function mapRow(row: {
  id: string; household_id: string; transaction_date: string; source_month: string | null; transaction_type: string;
  flow_class: string; cost_behavior: string | null; payment_method_id: string | null;
  category_id: string | null; subcategory_id: string | null; account_id: string | null; income_group: string | null; expense_group: string | null; parent_transaction_id: string | null;
  amount: number; description: string; memo: string | null; tags: string[] | null;
  include_in_budget: boolean; needs_review: boolean; recurring_rule_id: string | null;
  recurring_occurrence_id: string | null; status: string;
}): Transaction {
  return {
    id: row.id,
    householdId: row.household_id,
    transactionDate: row.transaction_date,
    sourceMonth: row.source_month,
    transactionType: row.transaction_type as TransactionType,
    flowClass: row.flow_class,
    costBehavior: row.cost_behavior as 'fixed' | 'variable' | null,
    paymentMethodId: row.payment_method_id,
    accountId: row.account_id,
    incomeGroup: row.income_group as 'fixed' | 'additional' | null,
    expenseGroup: row.expense_group as 'savings' | 'consumption' | null,
    parentTransactionId: row.parent_transaction_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
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
const TRANSACTION_COLUMNS = `id, household_id, transaction_date, source_month, transaction_type, flow_class, cost_behavior, payment_method_id, account_id, income_group, expense_group, parent_transaction_id, category_id, subcategory_id, amount, description, memo, tags, include_in_budget, needs_review, recurring_rule_id, recurring_occurrence_id, status`;
const TRANSACTION_SUMMARY_COLUMNS = 'id, transaction_date, source_month, transaction_type, flow_class, payment_method_id, category_id, subcategory_id, amount, description, status';

export async function createTransaction(input: {
  householdId: string;
  transactionDate: string;
  sourceMonth?: string | null;
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
      amount: input.amount,
      description: input.description,
      memo: input.memo ?? null,
      tags: input.tags ?? [],
      // 참고 거래는 예산 집계 대상이 아니다(사용자 지시) — flow_class가 이미 'excluded'라
      // include_in_budget 필터를 쓰는 집계 어디서도 안 걸리지만, 명시적으로도 false로 남긴다.
      include_in_budget: includeInBudget(input.transactionType),
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
  sourceMonth?: string | null;
  transactionType: 'income' | 'expense' | 'reference';
  // 환불/취소로 감지된 원본 행은 이제 transactionType='refund'가 아니라 status='refunded'로
  // 들어온다(호출부인 TransactionImport.tsx/WorkbookMonthlyImport.tsx가 변환).
  status?: 'posted' | 'refunded';
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
      source_month: row.sourceMonth ?? null,
      transaction_type: row.transactionType,
      flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[row.transactionType],
      cost_behavior: costBehavior,
      payment_method_id: row.paymentMethodId,
      category_id: row.categoryId ?? null,
      subcategory_id: row.subcategoryId ?? null,
      amount: row.amount,
      description: row.description.trim(),
      memo: row.memo ?? null,
      // createTransaction()/updateTransaction()과 동일한 규칙으로 통일했다(사용자 지시) — 예전엔
      // 'expense'인지만 봤는데, 그러면 임포트된 income 행은 항상 include_in_budget=false로
      // 저장됐다(하위 집계가 전부 flow_class='consumption'을 먼저 걸러서 지금은 무해하지만,
      // 값 자체가 저장 규칙과 어긋나는 잠재 결함이었다).
      include_in_budget: includeInBudget(row.transactionType),
      needs_review: row.needsReview ?? row.status === 'refunded',
      status: row.status ?? 'posted',
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
  reportMonthFrom?: string;
  reportMonthTo?: string;
}): Promise<Transaction[]> {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: Parameters<typeof mapRow>[0][] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('transactions').select(TRANSACTION_COLUMNS)
      .eq('household_id', filter.householdId).is('deleted_at', null)
      .order('transaction_date', { ascending: false }).order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (filter.reportMonthFrom && filter.reportMonthTo && filter.fromDate && filter.toDate) {
      query = query.or(`and(source_month.gte.${filter.reportMonthFrom},source_month.lte.${filter.reportMonthTo}),and(source_month.is.null,transaction_date.gte.${filter.fromDate},transaction_date.lte.${filter.toDate})`);
    } else {
      if (filter.fromDate) query = query.gte('transaction_date', filter.fromDate);
      if (filter.toDate) query = query.lte('transaction_date', filter.toDate);
    }
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

/**
 * 차트·요약용 경량 조회입니다. 거래 상세 화면은 listTransactions를 사용하고,
 * 집계 화면은 이 조회로 불필요한 상세 컬럼과 변환 비용을 줄입니다.
 */
export async function listTransactionSummaries(filter: {
  householdId: string;
  fromDate?: string;
  toDate?: string;
  reportMonthFrom?: string;
  reportMonthTo?: string;
}): Promise<TransactionSummary[]> {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: Array<{
    id: string; transaction_date: string; source_month: string | null; transaction_type: string;
    flow_class: string; payment_method_id: string | null; category_id: string | null;
    subcategory_id: string | null; amount: number; description: string; status: string;
  }> = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('transactions').select(TRANSACTION_SUMMARY_COLUMNS)
      .eq('household_id', filter.householdId).is('deleted_at', null)
      .order('transaction_date', { ascending: false }).order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (filter.reportMonthFrom && filter.reportMonthTo && filter.fromDate && filter.toDate) {
      query = query.or(`and(source_month.gte.${filter.reportMonthFrom},source_month.lte.${filter.reportMonthTo}),and(source_month.is.null,transaction_date.gte.${filter.fromDate},transaction_date.lte.${filter.toDate})`);
    } else {
      if (filter.fromDate) query = query.gte('transaction_date', filter.fromDate);
      if (filter.toDate) query = query.lte('transaction_date', filter.toDate);
    }
    const { data, error } = await query;
    if (error) throw new Error(`거래 요약 조회 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }

  return rows.map((row) => ({
    id: row.id,
    transactionDate: row.transaction_date,
    sourceMonth: row.source_month,
    transactionType: row.transaction_type as Transaction['transactionType'],
    flowClass: row.flow_class,
    paymentMethodId: row.payment_method_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    amount: row.amount,
    description: row.description,
    status: row.status as Transaction['status'],
  }));
}

// 2026-09 Excel migration follow-up: surfaces every transaction the migration (or any other
// import path) flagged needs_review=true so a household member can review/fix/confirm/delete
// them from a dedicated screen (src/app/(app)/review) rather than hunting through /monthly.
export async function listTransactionsNeedingReview(householdId: string): Promise<Transaction[]> {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: Parameters<typeof mapRow>[0][] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('transactions').select(TRANSACTION_COLUMNS)
      .eq('household_id', householdId).eq('needs_review', true).is('deleted_at', null)
      .order('transaction_date', { ascending: false }).order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`검토 필요 거래 조회 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows.map(mapRow);
}

// Cheap existence/count check for hiding the review entry point once nothing is left to review —
// select('id') rather than the full TRANSACTION_COLUMNS payload since only the count is needed.
export async function countTransactionsNeedingReview(householdId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId).eq('needs_review', true).is('deleted_at', null);
  if (error) throw new Error(`검토 필요 거래 건수 조회 실패: ${error.message}`);
  return count ?? 0;
}

// Marks a transaction as reviewed. Separate from updateTransaction (which stays generic and
// never touches needs_review) so editing a transaction elsewhere in the app never silently
// clears a review flag someone else needs to see — this is an explicit "확정" action.
export async function confirmTransactionReview(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: reviewRow, error: readError } = await supabase.from('transactions')
    .select('id, household_id, transaction_date, transaction_type, amount, description, source_month')
    .eq('id', id).eq('needs_review', true).is('deleted_at', null).maybeSingle();
  if (readError) throw new Error(`검토 필요 거래 조회 실패: ${readError.message}`);
  if (!reviewRow) throw new Error('검토 완료 처리할 거래를 찾지 못했어요.');

  // Import review rows can coexist with the canonical monthly row when the same
  // workbook entry was imported through both paths. Only merge when there is one
  // exact, already-confirmed row with an owning source month; ambiguous matches
  // must remain visible for manual review.
  const { data: canonicalRows, error: duplicateReadError } = await supabase.from('transactions')
    .select('id')
    .eq('household_id', reviewRow.household_id)
    .eq('transaction_date', reviewRow.transaction_date)
    .eq('transaction_type', reviewRow.transaction_type)
    .eq('amount', reviewRow.amount)
    .eq('description', reviewRow.description)
    .eq('needs_review', false)
    .not('source_month', 'is', null)
    .is('deleted_at', null)
    .neq('id', id);
  if (duplicateReadError) throw new Error(`중복 거래 확인 실패: ${duplicateReadError.message}`);

  if (canonicalRows?.length === 1) {
    const { data, error } = await supabase.from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id).eq('needs_review', true).is('deleted_at', null).select('id');
    if (error) throw new Error(`중복 검토 거래 정리 실패: ${error.message}`);
    if (data.length !== 1) throw new Error('중복 검토 거래를 정리하지 못했어요.');
    return;
  }

  const { data, error } = await supabase.from('transactions')
    .update({ needs_review: false })
    .eq('id', id).eq('needs_review', true).is('deleted_at', null).select('id');
  if (error) throw new Error(`검토 완료 처리 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('검토 완료 처리할 거래를 찾지 못했어요.');
}

// 대시보드 "월별 상세" 연도 선택기(2026-09)를 위한 실제 데이터 연도 범위. min/max 각각 인덱스
// (household_id, transaction_date) 스캔 1행으로 끝나 저렴하다 — 전체 조회 후 연도만 뽑는 방식보다
// 훨씬 가볍다. 2000년 이전 값은 걸러낸다(엑셀 마이그레이션의 날짜 파싱 오류로 생긴 1900-01-06
// 이상치 1건이 실제 연도 범위를 왜곡하지 않도록 — FINAL-REPORT.md §6.4 참고, 아직 수기 수정 전).
export async function getTransactionYearRange(householdId: string): Promise<{ minYear: number; maxYear: number } | null> {
  const supabase = await createClient();
  const base = () => supabase.from('transactions').select('transaction_date')
    .eq('household_id', householdId).eq('status', 'posted').is('deleted_at', null)
    .gte('transaction_date', '2000-01-01').limit(1);
  const [{ data: minRow, error: minError }, { data: maxRow, error: maxError }] = await Promise.all([
    base().order('transaction_date', { ascending: true }),
    base().order('transaction_date', { ascending: false }),
  ]);
  if (minError) throw new Error(`거래 최소 연도 조회 실패: ${minError.message}`);
  if (maxError) throw new Error(`거래 최대 연도 조회 실패: ${maxError.message}`);
  if (!minRow?.length || !maxRow?.length) return null;
  return { minYear: Number(minRow[0].transaction_date.slice(0, 4)), maxYear: Number(maxRow[0].transaction_date.slice(0, 4)) };
}

export async function promotePastPlannedTransactions(householdId: string, currentMonthStart: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'posted' })
    .eq('household_id', householdId)
    .eq('status', 'planned')
    .lt('transaction_date', currentMonthStart)
    .is('deleted_at', null);
  if (error) throw new Error(`지난 예정 거래 자동 확정 실패: ${error.message}`);
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

// 2026-09: 등록 드로워(createTransaction)와 같은 필드 세트를 하나의 UPDATE로 저장한다 — 예전에는
// "거래 정보"(updateTransactionBasics)와 "분류"(updateTransactionClassification)가 같은 행을
// 컬럼만 나눠 두 번 UPDATE했고, 그래서 드로어에도 저장 버튼이 두 개였다(사용자 지시로 통일).
// createTransaction과 동일하게 cost_behavior/flow_class를 다시 계산한다 — 거래 유형이 바뀌면
// 두 값 다 새로 정해져야 하기 때문.
export async function updateTransaction(input: {
  id: string;
  transactionDate: string;
  amount: number;
  description: string;
  memo: string | null;
  transactionType: TransactionType;
  categoryId: string | null;
  categoryDefaultCostBehavior: 'fixed' | 'variable' | null;
  costBehaviorOverride?: 'fixed' | 'variable' | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  incomeGroup?: 'fixed' | 'additional' | null;
}): Promise<void> {
  if (input.amount <= 0) {
    throw new Error('금액은 0보다 커야 합니다.');
  }

  const supabase = await createClient();
  const costBehavior = resolveCostBehavior(
    input.transactionType,
    input.categoryDefaultCostBehavior,
    input.costBehaviorOverride ?? null,
  );

  const { data, error } = await supabase.from('transactions').update({
    transaction_date: input.transactionDate,
    amount: input.amount,
    description: input.description,
    memo: input.memo,
    transaction_type: input.transactionType,
    flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[input.transactionType],
    cost_behavior: costBehavior,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    payment_method_id: input.paymentMethodId,
    // 수입이 아니게 바뀌면 income_group도 함께 지운다(예: 참고 거래로 전환) — expense_group은
    // DB 트리거가 항상 알아서 맞추므로 여기서 손대지 않는다.
    income_group: input.transactionType === 'income' ? (input.incomeGroup ?? null) : null,
    // 참고 거래로 전환하면 예산 집계 대상에서 빠지고, 수입/지출로 되돌리면 다시 포함된다.
    include_in_budget: includeInBudget(input.transactionType),
  }).eq('id', input.id).is('deleted_at', null).select('id');
  if (error) throw new Error(`거래 수정 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('수정할 거래를 찾지 못했어요.');
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
