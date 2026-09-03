import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { FLOW_CLASS_BY_TRANSACTION_TYPE } from '@/lib/transactions';
import type { CostBehavior, TransactionType } from '@/lib/cost-behavior';
import { excludePausedDates, listOccurrenceDates, type RecurrenceFrequency } from '@/lib/recurrence';
import { buildLoanOccurrenceAmounts, type LoanOccurrenceAmounts } from '@/lib/product-recurring';
import { upsertSupportDetail } from '@/lib/transaction-details';

export type RecurringRuleStatus = 'active' | 'paused' | 'ended';
export type RecurringSourceType = 'insurance' | 'saving' | 'loan' | 'subscription' | 'salary' | 'support' | 'manual';

export type RecurringRule = {
  id: string;
  sourceId: string | null;
  description: string;
  defaultAmount: number;
  transactionType: TransactionType;
  categoryId: string | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  costBehavior: CostBehavior;
  memo: string | null;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  status: RecurringRuleStatus;
  sourceType: RecurringSourceType;
};

export type RecurringPause = {
  id: string;
  recurringRuleId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};
export type RecurringRuleChange = { id: string; recurringRuleId: string; changedAt: string; oldAmount: number; newAmount: number; oldStatus: string; newStatus: string; oldFrequency: string; newFrequency: string; oldIntervalCount: number; newIntervalCount: number; oldDayOfMonth: number | null; newDayOfMonth: number | null };

const RULE_COLUMNS = `id, source_id, description, default_amount, transaction_type, category_id, subcategory_id, payment_method_id, cost_behavior, memo, frequency, interval_count, day_of_month, start_date, end_date, status, source_type`;

export async function listRecurringRules(householdId: string): Promise<RecurringRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(RULE_COLUMNS)
    .eq('household_id', householdId)
    .order('status', { ascending: true })
    .order('start_date', { ascending: false });

  if (error) throw new Error(`반복항목 목록 조회 실패: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    description: row.description,
    defaultAmount: row.default_amount,
    transactionType: row.transaction_type as TransactionType,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    paymentMethodId: row.payment_method_id,
    costBehavior: row.cost_behavior as CostBehavior,
    memo: row.memo,
    frequency: row.frequency as RecurrenceFrequency,
    intervalCount: row.interval_count,
    dayOfMonth: row.day_of_month,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as RecurringRuleStatus,
    sourceType: row.source_type as RecurringSourceType,
  }));
}

export async function listRecurringPauses(householdId: string): Promise<RecurringPause[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('recurring_rule_pauses')
    .select('id, recurring_rule_id, start_date, end_date, reason')
    .eq('household_id', householdId)
    .order('start_date', { ascending: false });
  if (error) throw new Error(`일시중지 기간 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    recurringRuleId: row.recurring_rule_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
  }));
}

export async function listRecurringRuleChanges(householdId: string, ruleIds: string[]): Promise<RecurringRuleChange[]> {
  if (ruleIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('recurring_rule_change_history').select('id, recurring_rule_id, changed_at, old_amount, new_amount, old_status, new_status, old_frequency, new_frequency, old_interval_count, new_interval_count, old_day_of_month, new_day_of_month').eq('household_id', householdId).in('recurring_rule_id', ruleIds).order('changed_at', { ascending: false });
  if (error) throw new Error(`반복항목 변경이력 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, recurringRuleId: row.recurring_rule_id, changedAt: row.changed_at, oldAmount: row.old_amount, newAmount: row.new_amount, oldStatus: row.old_status, newStatus: row.new_status, oldFrequency: row.old_frequency, newFrequency: row.new_frequency, oldIntervalCount: row.old_interval_count, newIntervalCount: row.new_interval_count, oldDayOfMonth: row.old_day_of_month, newDayOfMonth: row.new_day_of_month }));
}

export async function createRecurringRule(input: {
  householdId: string;
  sourceType: RecurringSourceType;
  startDate: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfMonth: number | null;
  defaultAmount: number;
  transactionType: TransactionType;
  costBehavior: CostBehavior;
  categoryId: string | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  description: string;
}): Promise<void> {
  const supabase = await createClient();
  let costBehavior = input.costBehavior;

  if (costBehavior === null && input.transactionType === 'expense' && input.categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('default_cost_behavior')
      .eq('id', input.categoryId)
      .eq('household_id', input.householdId)
      .single();
    if (categoryError) throw new Error(`카테고리 확인 실패: ${categoryError.message}`);
    costBehavior = category.default_cost_behavior as CostBehavior;
  }

  if (input.transactionType !== 'expense') {
    costBehavior = null;
  }

  const { error } = await supabase.from('recurring_rules').insert({
    household_id: input.householdId,
    source_type: input.sourceType,
    start_date: input.startDate,
    end_date: input.endDate,
    frequency: input.frequency,
    interval_count: input.intervalCount,
    day_of_month: input.frequency === 'monthly' ? input.dayOfMonth : null,
    default_amount: input.defaultAmount,
    transaction_type: input.transactionType,
    flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[input.transactionType],
    cost_behavior: costBehavior,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    payment_method_id: input.paymentMethodId,
    description: input.description,
  });

  if (error) throw new Error(`반복항목 생성 실패: ${error.message}`);
}

// 2026-09: 반복 항목 추가/수정 드로워를 하나의 컴포넌트로 통일하면서(사용자 지시), 항목명·거래
// 유형·대분류·소분류·비용성격·결제수단·시작일·종료일·반복주기를 한 번에 저장하는 수정 액션을
// 새로 만들었다 — 예전에는 금액/주기만 따로 고칠 수 있었고 나머지는 수정 자체가 불가능했다.
//
// 대출·적금 상품이 자동으로 만든 반복항목(source_id가 있는 행)은 여기서 손대지 않는다 —
// amountFor()가 subcategory_id로 원금/이자를 구분하고, 상품의 실제 상환 일정과 반복 일정이
// 정확히 일치해야 하므로, 분류·일정을 이 화면에서 자유롭게 바꾸면 이후 회차 금액이 조용히
// 0원이 될 수 있다(§ recurring-rules.ts의 amountFor 참고). `.is('source_id', null)`이 UI가
// 이 경로를 막아주는 것과 무관하게 서버에서도 이를 강제한다 — 상품 연동 항목은 대출/적금
// 상품 화면에서만 관리된다.
export async function updateRecurringRule(input: {
  ruleId: string;
  description: string;
  transactionType: TransactionType;
  amount: number;
  categoryId: string | null;
  categoryDefaultCostBehavior: 'fixed' | 'variable' | null;
  costBehaviorOverride?: 'fixed' | 'variable' | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  memo: string | null;
  startDate: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfMonth: number | null;
}): Promise<void> {
  const supabase = await createClient();
  let costBehavior = input.costBehaviorOverride ?? null;
  if (costBehavior === null && input.transactionType === 'expense' && input.categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('default_cost_behavior')
      .eq('id', input.categoryId)
      .single();
    if (categoryError) throw new Error(`카테고리 확인 실패: ${categoryError.message}`);
    costBehavior = category.default_cost_behavior as CostBehavior;
  }
  if (input.transactionType !== 'expense') costBehavior = null;

  const patch = {
    description: input.description,
    default_amount: input.amount,
    transaction_type: input.transactionType,
    flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[input.transactionType],
    cost_behavior: costBehavior,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    payment_method_id: input.paymentMethodId,
    memo: input.memo,
    start_date: input.startDate,
    end_date: input.endDate,
    frequency: input.frequency,
    interval_count: input.intervalCount,
    day_of_month: input.frequency === 'monthly' ? input.dayOfMonth : null,
  };

  const { data, error } = await supabase.from('recurring_rules').update(patch)
    .eq('id', input.ruleId).is('source_id', null).neq('status', 'ended').select('id');
  if (error) throw new Error(`반복항목 수정 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('수정할 반복항목을 찾지 못했어요.');

  // 이미 확정된(posted) 과거 거래는 손대지 않고, 아직 예정(planned) 상태인 미래 거래만 새 값으로
  // 맞춘다(§4 사용자 지시) — 다음 materializeRecurringRulesForRange 실행을 기다릴 필요 없이 화면에
  // 바로 반영되고, recurring_occurrence_id 기준 upsert(ignoreDuplicates)라 중복도 생기지 않는다.
  const { error: syncError } = await supabase.from('transactions').update({
    description: input.description,
    amount: input.amount,
    transaction_type: input.transactionType,
    flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[input.transactionType],
    cost_behavior: costBehavior,
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    payment_method_id: input.paymentMethodId,
    memo: input.memo,
  }).eq('recurring_rule_id', input.ruleId).eq('status', 'planned').is('deleted_at', null);
  if (syncError) throw new Error(`예정 거래 반영 실패: ${syncError.message}`);
}

export async function updateRecurringRuleStatus(
  id: string,
  status: RecurringRuleStatus,
  effectiveDate: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_recurring_rule_status', {
    p_rule_id: id,
    p_status: status,
    p_effective_date: effectiveDate,
  });
  if (error) throw new Error(`반복항목 상태 변경 실패: ${error.message}`);
}

type MaterializationRule = {
  id: string;
  household_id: string;
  start_date: string;
  end_date: string | null;
  frequency: RecurrenceFrequency;
  interval_count: number;
  day_of_month: number | null;
  default_amount: number;
  transaction_type: TransactionType;
  flow_class: string;
  cost_behavior: CostBehavior;
  category_id: string | null;
  subcategory_id: string | null;
  payment_method_id: string | null;
  description: string;
  memo: string | null;
  include_in_budget: boolean;
  source_type: RecurringSourceType;
  source_id: string | null;
};

export async function materializeRecurringRulesForRange(
  householdId: string,
  fromDate: string,
  toDate: string,
): Promise<number> {
  const supabase = await createClient();
  const { data: rawRules, error: rulesError } = await supabase
    .from('recurring_rules')
    .select('id, household_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, category_id, subcategory_id, payment_method_id, description, memo, include_in_budget, source_type, source_id')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .eq('auto_generate', true)
    .lte('start_date', toDate)
    .or(`end_date.is.null,end_date.gte.${fromDate}`);

  if (rulesError) throw new Error(`반복항목 생성 대상 조회 실패: ${rulesError.message}`);
  const rules = (rawRules ?? []) as MaterializationRule[];
  const loanIds = [...new Set(rules.filter((rule) => rule.source_type === 'loan' && rule.source_id).map((rule) => rule.source_id as string))];
  const loanAmounts = new Map<string, Map<string, LoanOccurrenceAmounts>>();
  // 2026-09: 대출원금/금융비용은 이제 별도 transaction_type이 아니라 둘 다 'expense'다(주거비 카테고리의
  // 하위 카테고리로만 구분됨) — 그래서 원금 회차와 이자 회차를 가려낼 때 더 이상 transaction_type을 쓸 수
  // 없고, create_loan_recurring_rules() 트리거가 두 규칙을 만들 때 심어둔 subcategory_id(주담대 원금 /
  // 주담대 이자, 가구별로 다른 id)로 구분해야 한다.
  let principalSubcategoryId: string | null = null;
  let interestSubcategoryId: string | null = null;
  if (loanIds.length > 0) {
    const { data: loans, error: loanError } = await supabase.from('loans')
      .select('id, original_amount, annual_rate, repayment_method, first_payment_date, maturity_date, grace_months')
      .eq('household_id', householdId).in('id', loanIds);
    if (loanError) throw new Error(`대출 반복금액 조회 실패: ${loanError.message}`);
    for (const loan of loans ?? []) {
      loanAmounts.set(loan.id, buildLoanOccurrenceAmounts({
        id: loan.id, originalAmount: loan.original_amount, annualRate: Number(loan.annual_rate),
        repaymentMethod: loan.repayment_method, firstPaymentDate: loan.first_payment_date,
        maturityDate: loan.maturity_date, graceMonths: loan.grace_months,
      }));
    }
    const { data: housingSubcategories, error: subcategoryError } = await supabase.from('subcategories')
      .select('id, name, categories!inner(household_id, name)')
      .eq('categories.household_id', householdId)
      .eq('categories.name', '주거비')
      .in('name', ['주담대 원금', '주담대 이자']);
    if (subcategoryError) throw new Error(`대출 하위카테고리 조회 실패: ${subcategoryError.message}`);
    for (const row of housingSubcategories ?? []) {
      if (row.name === '주담대 원금') principalSubcategoryId = row.id;
      if (row.name === '주담대 이자') interestSubcategoryId = row.id;
    }
  }
  const amountFor = (rule: MaterializationRule, occurrenceDate: string): number => {
    if (rule.source_type !== 'loan' || !rule.source_id) return rule.default_amount;
    const amounts = loanAmounts.get(rule.source_id)?.get(occurrenceDate);
    if (!amounts) return 0;
    // "주담대 원금"/"주담대 이자" 소분류를 못 찾으면 principalSubcategoryId/interestSubcategoryId가
    // 둘 다 null로 남는데, rule.subcategory_id도 마침 null이면 `null === null`이 우연히 true가 되어
    // 원금·이자가 뒤섞일 수 있었다(사용자 지시로 조사·수정). 두 id를 못 찾은 경우는 애초에 금액을
    // 판단할 수 없는 상태이므로 0을 반환한다 — 이제 create_loan_recurring_rules() DB 트리거가
    // 카테고리를 못 찾으면 규칙 생성 자체를 막으므로(20260909110000), 정상 가계에서는 이 분기를
    // 타지 않는다.
    if (principalSubcategoryId === null || interestSubcategoryId === null) return 0;
    return rule.subcategory_id === principalSubcategoryId ? amounts.debtPrincipal
      : rule.subcategory_id === interestSubcategoryId ? amounts.financeCost : 0;
  };
  const { data: rawPauses, error: pausesError } = rules.length === 0
    ? { data: [], error: null }
    : await supabase.from('recurring_rule_pauses')
      .select('recurring_rule_id, start_date, end_date')
      .eq('household_id', householdId)
      .in('recurring_rule_id', rules.map((rule) => rule.id))
      .lte('start_date', toDate)
      .gte('end_date', fromDate);
  if (pausesError) throw new Error(`일시중지 기간 조회 실패: ${pausesError.message}`);
  const pausesByRule = new Map<string, { startDate: string; endDate: string }[]>();
  for (const pause of rawPauses ?? []) {
    const ranges = pausesByRule.get(pause.recurring_rule_id) ?? [];
    ranges.push({ startDate: pause.start_date, endDate: pause.end_date });
    pausesByRule.set(pause.recurring_rule_id, ranges);
  }
  const { data: preexistingOccurrences, error: preexistingError } = rules.length === 0
    ? { data: [], error: null }
    : await supabase.from('recurring_occurrences')
       .select('recurring_rule_id, occurrence_date')
      .eq('household_id', householdId)
      .in('recurring_rule_id', rules.map((rule) => rule.id))
      .gte('occurrence_date', fromDate)
      .lte('occurrence_date', toDate);
  if (preexistingError) throw new Error(`기존 반복 회차 조회 실패: ${preexistingError.message}`);
  const materializedOccurrenceKeys = new Set(
    (preexistingOccurrences ?? []).map((row) => `${row.recurring_rule_id}:${row.occurrence_date}`),
  );
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const occurrenceRows = rules.flatMap((rule) => excludePausedDates(listOccurrenceDates({
    startDate: rule.start_date,
    endDate: rule.end_date,
    frequency: rule.frequency,
    intervalCount: rule.interval_count,
    dayOfMonth: rule.day_of_month,
  }, fromDate, toDate), pausesByRule.get(rule.id) ?? [])
    .filter((occurrenceDate) => amountFor(rule, occurrenceDate) > 0)
    .filter((occurrenceDate) => !materializedOccurrenceKeys.has(`${rule.id}:${occurrenceDate}`))
    .map((occurrenceDate) => ({
      household_id: householdId,
      recurring_rule_id: rule.id,
      occurrence_date: occurrenceDate,
    })));

  if (occurrenceRows.length > 0) {
    const { error: occurrenceError } = await supabase.from('recurring_occurrences').upsert(
      occurrenceRows,
      { onConflict: 'recurring_rule_id,occurrence_date', ignoreDuplicates: true },
    );
    if (occurrenceError) throw new Error(`반복 회차 생성 실패: ${occurrenceError.message}`);
  }

  const { data: occurrences, error: readError } = await supabase
    .from('recurring_occurrences')
    .select('id, recurring_rule_id, occurrence_date')
    .eq('household_id', householdId)
    .in('recurring_rule_id', rules.map((rule) => rule.id))
    .gte('occurrence_date', fromDate)
    .lte('occurrence_date', toDate);
  if (readError) throw new Error(`반복 회차 조회 실패: ${readError.message}`);

  const transactionRows = (occurrences ?? []).flatMap((occurrence) => {
    const rule = ruleById.get(occurrence.recurring_rule_id);
    if (!rule) return [];
    return [{
      household_id: householdId,
      transaction_date: occurrence.occurrence_date,
      transaction_type: rule.transaction_type,
      flow_class: rule.flow_class,
      cost_behavior: rule.cost_behavior,
      category_id: rule.category_id,
      subcategory_id: rule.subcategory_id,
      payment_method_id: rule.payment_method_id,
      recurring_rule_id: rule.id,
      recurring_occurrence_id: occurrence.id,
      amount: amountFor(rule, occurrence.occurrence_date),
      description: rule.description,
      memo: rule.memo,
      include_in_budget: rule.include_in_budget,
      status: 'planned',
    }];
  });

  if (transactionRows.length === 0) return 0;
  const { data: inserted, error: transactionError } = await supabase
    .from('transactions')
    .upsert(transactionRows, { onConflict: 'recurring_occurrence_id', ignoreDuplicates: true })
    .select('id');
  if (transactionError) throw new Error(`반복 예정거래 생성 실패: ${transactionError.message}`);
  const supportRules = rules.filter((rule) => rule.source_type === 'support' && rule.transaction_type === 'income');
  if (supportRules.length > 0) {
    const supportRuleIds = supportRules.map((rule) => rule.id);
    const { data: supportTransactions, error: supportTransactionError } = await supabase.from('transactions').select('id, recurring_rule_id, amount').eq('household_id', householdId).eq('status', 'planned').in('recurring_rule_id', supportRuleIds).is('deleted_at', null);
    if (supportTransactionError) throw new Error(`지원금 예정 상세 연결 실패: ${supportTransactionError.message}`);
    const supportNameByRule = new Map(supportRules.map((rule) => [rule.id, rule.description]));
    const totalExpectedByRule = new Map<string, number>();
    for (const transaction of supportTransactions ?? []) {
      totalExpectedByRule.set(
        transaction.recurring_rule_id,
        (totalExpectedByRule.get(transaction.recurring_rule_id) ?? 0) + transaction.amount,
      );
    }
    for (const transaction of supportTransactions ?? []) {
      await upsertSupportDetail(householdId, {
        transactionId: transaction.id,
        supportKind: supportNameByRule.get(transaction.recurring_rule_id) ?? '정부지원금',
        eligibility: null,
        applicationPeriod: null,
        receivingPeriod: null,
        payoutCycle: 'monthly',
        expectedDate: null,
        amountPerOccurrence: transaction.amount,
        totalExpectedAmount: totalExpectedByRule.get(transaction.recurring_rule_id) ?? transaction.amount,
        status: 'planned',
        issuer: null,
        contact: null,
        sourceUrl: null,
        memo: null,
      });
    }
  }
  return inserted?.length ?? 0;
}

export async function linkRecurringOccurrence(input: {
  occurrenceId: string;
  plannedTransactionId: string;
  postedTransactionId: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('link_recurring_occurrence', {
    p_occurrence_id: input.occurrenceId,
    p_planned_transaction_id: input.plannedTransactionId,
    p_posted_transaction_id: input.postedTransactionId,
  });
  if (error) throw new Error(`기존 거래 연결 실패: ${error.message}`);
}

export async function updateRecurringRuleAmount(input: {
  ruleId: string;
  amount: number;
  effectiveDate: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_recurring_rule_amount', {
    p_rule_id: input.ruleId,
    p_amount: input.amount,
    p_effective_date: input.effectiveDate,
  });
  if (error) throw new Error(`반복 금액 변경 실패: ${error.message}`);
}

export async function updateRecurringRuleAmountOnce(input: { ruleId: string; amount: number; effectiveDate: string }): Promise<void> {
  const monthStart = `${input.effectiveDate.slice(0, 7)}-01`;
  const [year, month] = input.effectiveDate.slice(0, 7).split('-').map(Number);
  const monthEnd = `${input.effectiveDate.slice(0, 7)}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
  const supabase = await createClient();
  const { data, error } = await supabase.from('transactions').update({ amount: input.amount })
    .eq('recurring_rule_id', input.ruleId).eq('status', 'planned').is('deleted_at', null)
    .gte('transaction_date', monthStart).lte('transaction_date', monthEnd).select('id');
  if (error) throw new Error(`이번 달 반복 금액 변경 실패: ${error.message}`);
  if (!data.length) throw new Error('이번 달에 변경할 예정 거래가 없어요.');
}

export async function addRecurringPausePeriod(input: {
  ruleId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_recurring_pause_period', {
    p_rule_id: input.ruleId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason,
  });
  if (error) throw new Error(`일시중지 기간 추가 실패: ${error.message}`);
}
