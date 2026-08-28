import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { FLOW_CLASS_BY_TRANSACTION_TYPE } from '@/lib/transactions';
import type { CostBehavior, TransactionType } from '@/lib/cost-behavior';
import { listOccurrenceDates, type RecurrenceFrequency } from '@/lib/recurrence';

export type RecurringRuleStatus = 'active' | 'paused' | 'ended';
export type RecurringSourceType = 'insurance' | 'saving' | 'loan' | 'subscription' | 'salary' | 'manual';

export type RecurringRule = {
  id: string;
  description: string;
  defaultAmount: number;
  transactionType: TransactionType;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  status: RecurringRuleStatus;
  sourceType: RecurringSourceType;
};

const RULE_COLUMNS = `id, description, default_amount, transaction_type, frequency, interval_count, day_of_month, start_date, end_date, status, source_type`;

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
    description: row.description,
    defaultAmount: row.default_amount,
    transactionType: row.transaction_type as TransactionType,
    frequency: row.frequency as RecurrenceFrequency,
    intervalCount: row.interval_count,
    dayOfMonth: row.day_of_month,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as RecurringRuleStatus,
    sourceType: row.source_type as RecurringSourceType,
  }));
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

  if (input.transactionType !== 'expense' && input.transactionType !== 'finance_cost') {
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

export async function updateRecurringRuleStatus(id: string, status: RecurringRuleStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('recurring_rules').update({ status }).eq('id', id);
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
  payer_member_id: string | null;
  beneficiary_member_id: string | null;
  description: string;
  memo: string | null;
  include_in_budget: boolean;
};

export async function materializeRecurringRulesForRange(
  householdId: string,
  fromDate: string,
  toDate: string,
): Promise<number> {
  const supabase = await createClient();
  const { data: rawRules, error: rulesError } = await supabase
    .from('recurring_rules')
    .select('id, household_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, category_id, subcategory_id, payment_method_id, payer_member_id, beneficiary_member_id, description, memo, include_in_budget')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .eq('auto_generate', true)
    .lte('start_date', toDate)
    .or(`end_date.is.null,end_date.gte.${fromDate}`);

  if (rulesError) throw new Error(`반복항목 생성 대상 조회 실패: ${rulesError.message}`);
  const rules = (rawRules ?? []) as MaterializationRule[];
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const occurrenceRows = rules.flatMap((rule) => listOccurrenceDates({
    startDate: rule.start_date,
    endDate: rule.end_date,
    frequency: rule.frequency,
    intervalCount: rule.interval_count,
    dayOfMonth: rule.day_of_month,
  }, fromDate, toDate).map((occurrenceDate) => ({
    household_id: householdId,
    recurring_rule_id: rule.id,
    occurrence_date: occurrenceDate,
  })));

  if (occurrenceRows.length === 0) return 0;
  const { error: occurrenceError } = await supabase.from('recurring_occurrences').upsert(
    occurrenceRows,
    { onConflict: 'recurring_rule_id,occurrence_date', ignoreDuplicates: true },
  );
  if (occurrenceError) throw new Error(`반복 회차 생성 실패: ${occurrenceError.message}`);

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
      payer_member_id: rule.payer_member_id,
      beneficiary_member_id: rule.beneficiary_member_id,
      recurring_rule_id: rule.id,
      recurring_occurrence_id: occurrence.id,
      amount: rule.default_amount,
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
