import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('product-backed recurring rules', () => {
  const admin: SupabaseClient = createClient(url, serviceRoleKey);
  const user = createClient(url, publishableKey);
  const email = `product-recurring-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'Product-Recurring-Test-1!';
  let userId = '';
  let householdId = '';
  let savingsId = '';
  let savingsRuleId = '';

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('failed to create product test user');
    userId = data.user.id;
    const { data: household, error: householdError } = await admin.from('households')
      .insert({ owner_user_id: userId, name: '상품 반복 테스트' }).select('id').single();
    if (householdError || !household) throw householdError ?? new Error('failed to create household');
    householdId = household.id;
    const { error: signInError } = await user.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it('creates a saving rule with saving flow and the product source id', async () => {
    const { data: savings, error } = await user.from('savings_accounts').insert({
      household_id: householdId, bank_name: '테스트뱅크', product_name: '적금', joined_at: '2026-01-01',
      maturity_date: '2026-12-31', monthly_amount: 500_000, annual_rate: 0.03, tax_rate: 0.154,
      current_savings: 0, monthly_payment_day: 25, auto_recurring: true,
    }).select('id').single();
    expect(error).toBeNull(); savingsId = savings!.id;
    const { data: rule, error: ruleError } = await user.from('recurring_rules')
      .select('id, source_type, source_id, transaction_type, flow_class, default_amount')
      .eq('source_type', 'saving').eq('source_id', savingsId).single();
    expect(ruleError).toBeNull();
    expect(rule).toMatchObject({ source_type: 'saving', source_id: savingsId, transaction_type: 'saving', flow_class: 'saving', default_amount: 500_000 });
    savingsRuleId = rule!.id;
  });

  it('creates distinct debt-principal and finance-cost rules for a loan', async () => {
    const { data: loan, error } = await user.from('loans').insert({
      household_id: householdId, institution_name: '테스트은행', loan_name: '대출', original_amount: 10_800_000,
      annual_rate: 0.04, repayment_method: 'equal_principal', loan_date: '2025-12-31',
      first_payment_date: '2026-01-31', maturity_date: '2026-12-31', grace_months: 0,
    }).select('id').single();
    expect(error).toBeNull();
    const { data: rules, error: rulesError } = await user.from('recurring_rules')
      .select('transaction_type, flow_class').eq('source_type', 'loan').eq('source_id', loan!.id).order('transaction_type');
    expect(rulesError).toBeNull();
    expect(rules).toEqual([
      { transaction_type: 'debt_principal', flow_class: 'debt_principal' },
      { transaction_type: 'finance_cost', flow_class: 'finance_cost' },
    ]);
  });

  it('ends the product rule and skips future planned rows in the same update', async () => {
    const { data: occurrence, error: occurrenceError } = await user.from('recurring_occurrences').insert({
      household_id: householdId, recurring_rule_id: savingsRuleId, occurrence_date: '2026-10-25',
    }).select('id').single();
    expect(occurrenceError).toBeNull();
    const { data: transaction, error: transactionError } = await user.from('transactions').insert({
      household_id: householdId, transaction_date: '2026-10-25', transaction_type: 'saving', flow_class: 'saving',
      amount: 500_000, description: '적금', status: 'planned', recurring_rule_id: savingsRuleId,
      recurring_occurrence_id: occurrence!.id,
    }).select('id').single();
    expect(transactionError).toBeNull();
    const { error: endError } = await user.from('savings_accounts').update({
      status: 'terminated', ended_at: '2026-08-29', auto_recurring: false,
    }).eq('id', savingsId);
    expect(endError).toBeNull();
    const [{ data: rule }, { data: row }] = await Promise.all([
      user.from('recurring_rules').select('status').eq('id', savingsRuleId).single(),
      user.from('transactions').select('status').eq('id', transaction!.id).single(),
    ]);
    expect(rule?.status).toBe('ended');
    expect(row?.status).toBe('skipped');
  });

  it('rejects a product source id that is not a product in this household', async () => {
    const { error } = await user.from('recurring_rules').insert({
      household_id: householdId, source_type: 'insurance', source_id: savingsId,
      start_date: '2026-01-01', frequency: 'monthly', interval_count: 1, day_of_month: 1,
      default_amount: 10_000, transaction_type: 'expense', flow_class: 'consumption',
      description: '잘못된 연결',
    });
    expect(error).not.toBeNull();
  });

  it('does not reactivate a product after its linked rule became terminal', async () => {
    const { error } = await user.from('savings_accounts').update({ status: 'active', ended_at: null }).eq('id', savingsId);
    expect(error).not.toBeNull();
  });

  it('does not link a saving occurrence to a consumption transaction', async () => {
    const { data: savings } = await user.from('savings_accounts').insert({
      household_id: householdId, bank_name: '테스트뱅크', product_name: '두번째 적금', joined_at: '2026-01-01',
      maturity_date: '2026-12-31', monthly_amount: 300_000, annual_rate: 0.03,
      monthly_payment_day: 20, auto_recurring: true,
    }).select('id').single();
    const { data: rule } = await user.from('recurring_rules').select('id')
      .eq('source_type', 'saving').eq('source_id', savings!.id).single();
    const { data: occurrence } = await user.from('recurring_occurrences').insert({
      household_id: householdId, recurring_rule_id: rule!.id, occurrence_date: '2026-09-20',
    }).select('id').single();
    const { data: planned } = await user.from('transactions').insert({
      household_id: householdId, transaction_date: '2026-09-20', transaction_type: 'saving', flow_class: 'saving',
      amount: 300_000, description: '적금 예정', status: 'planned', recurring_rule_id: rule!.id,
      recurring_occurrence_id: occurrence!.id,
    }).select('id').single();
    const { data: posted } = await user.from('transactions').insert({
      household_id: householdId, transaction_date: '2026-09-20', transaction_type: 'expense', flow_class: 'consumption',
      amount: 300_000, description: '소비', status: 'posted',
    }).select('id').single();
    const { error } = await user.rpc('link_recurring_occurrence', {
      p_occurrence_id: occurrence!.id, p_planned_transaction_id: planned!.id, p_posted_transaction_id: posted!.id,
    });
    expect(error).not.toBeNull();
    const { data: unchanged } = await user.from('transactions').select('status').eq('id', planned!.id).single();
    expect(unchanged?.status).toBe('planned');
  });
});
