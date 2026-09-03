import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 2026-09: 거래 유형이 수입/지출 두 가지로 축소되면서 저축/대출원금상환/금융비용은 더 이상
// transaction_type이 아니다 — create_savings_recurring_rule()/create_loan_recurring_rules()
// 트리거가 이제 항상 transaction_type='expense', flow_class='consumption'을 넣고, 저축은
// 지출>저축성지출>예/적금 서브카테고리로, 대출은 지출>주거비>주담대 원금/이자 서브카테고리로
// 구분한다. 그래서 이 테스트도 transaction_type/flow_class 대신 subcategory_id로 검증한다.
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
    // households.owner_user_id는 ON DELETE CASCADE라 유저를 지우면 household/거래도 함께
    // 지워지지만, 프로세스가 중간에 죽거나 삭제가 실패하면 household가 그대로 남는다(실제로
    // 이 테스트가 남긴 좀비 household 6개를 마이그레이션 중 발견해 정리한 적이 있다) — 그래서
    // household도 명시적으로 지우고 두 삭제 결과를 모두 확인한다.
    if (householdId) {
      const { error } = await admin.from('households').delete().eq('id', householdId);
      if (error) console.error('product-recurring cleanup: household delete failed', error.message);
    }
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error('product-recurring cleanup: user delete failed', error.message);
    }
  });

  it('creates a saving rule as an expense against 저축성지출 > 예/적금', async () => {
    const { data: savings, error } = await user.from('savings_accounts').insert({
      household_id: householdId, bank_name: '테스트뱅크', product_name: '적금', joined_at: '2026-01-01',
      maturity_date: '2026-12-31', monthly_amount: 500_000, annual_rate: 0.03, tax_rate: 0.154,
      current_savings: 0, monthly_payment_day: 25, auto_recurring: true,
    }).select('id').single();
    expect(error).toBeNull(); savingsId = savings!.id;
    const { data: rule, error: ruleError } = await user.from('recurring_rules')
      .select('id, source_type, source_id, transaction_type, flow_class, default_amount, category_id, subcategory_id')
      .eq('source_type', 'saving').eq('source_id', savingsId).single();
    expect(ruleError).toBeNull();
    expect(rule).toMatchObject({ source_type: 'saving', source_id: savingsId, transaction_type: 'expense', flow_class: 'consumption', default_amount: 500_000 });
    expect(rule!.category_id).not.toBeNull();
    expect(rule!.subcategory_id).not.toBeNull();
    savingsRuleId = rule!.id;
  });

  it('creates distinct principal and interest rules for a loan, both as expense', async () => {
    const { data: loan, error } = await user.from('loans').insert({
      household_id: householdId, institution_name: '테스트은행', loan_name: '대출', original_amount: 10_800_000,
      annual_rate: 0.04, repayment_method: 'equal_principal', loan_date: '2025-12-31',
      first_payment_date: '2026-01-31', maturity_date: '2026-12-31', grace_months: 0,
    }).select('id').single();
    expect(error).toBeNull();
    const { data: rules, error: rulesError } = await user.from('recurring_rules')
      .select('transaction_type, flow_class, subcategory_id').eq('source_type', 'loan').eq('source_id', loan!.id);
    expect(rulesError).toBeNull();
    expect(rules).toHaveLength(2);
    // 원금/이자 두 규칙 모두 지출·소비성이지만, 서로 다른 서브카테고리(주담대 원금 / 주담대 이자)로
    // 구분된다 — recurring_rules_one_product_flow 유니크 인덱스가 이 subcategory_id로 원금/이자를
    // 가려낸다(transaction_type만으로는 더 이상 구분할 수 없다).
    for (const rule of rules ?? []) expect(rule).toMatchObject({ transaction_type: 'expense', flow_class: 'consumption' });
    const subcategoryIds = new Set((rules ?? []).map((rule) => rule.subcategory_id));
    expect(subcategoryIds.size).toBe(2);
    expect([...subcategoryIds].every((id) => id !== null)).toBe(true);
  });

  it('ends the product rule and skips future planned rows in the same update', async () => {
    const { data: occurrence, error: occurrenceError } = await user.from('recurring_occurrences').insert({
      household_id: householdId, recurring_rule_id: savingsRuleId, occurrence_date: '2026-10-25',
    }).select('id').single();
    expect(occurrenceError).toBeNull();
    const { data: transaction, error: transactionError } = await user.from('transactions').insert({
      household_id: householdId, transaction_date: '2026-10-25', transaction_type: 'expense', flow_class: 'consumption',
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

  // link_recurring_occurrence()는 transaction_type과 flow_class가 모두 같은 posted 거래로만
  // 연결을 허용한다. 저축이 지출/소비성으로 통합되면서 "저축 예정 vs 일반 소비"는 더 이상 이
  // 두 축만으로 구분되지 않으므로(카테고리가 다를 뿐), 이 가드가 여전히 실제로 차단하는 경우인
  // "수입 예정 vs 지출 확정"으로 검증한다.
  it('does not link a planned income occurrence to a posted expense transaction', async () => {
    const { data: rule, error: ruleError } = await user.from('recurring_rules').insert({
      household_id: householdId, source_type: 'manual', start_date: '2026-01-01', frequency: 'monthly',
      interval_count: 1, day_of_month: 20, default_amount: 300_000, transaction_type: 'income',
      flow_class: 'cash_in', description: '용돈',
    }).select('id').single();
    expect(ruleError).toBeNull();
    const { data: occurrence } = await user.from('recurring_occurrences').insert({
      household_id: householdId, recurring_rule_id: rule!.id, occurrence_date: '2026-09-20',
    }).select('id').single();
    const { data: planned } = await user.from('transactions').insert({
      household_id: householdId, transaction_date: '2026-09-20', transaction_type: 'income', flow_class: 'cash_in',
      amount: 300_000, description: '용돈 예정', status: 'planned', recurring_rule_id: rule!.id,
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
