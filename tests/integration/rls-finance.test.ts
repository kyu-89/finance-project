import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
type TableCase = { table: string; id: string; spoof: Record<string, unknown>; update: Record<string, unknown> };

describe('Sprint 4 finance table RLS', () => {
  const admin: SupabaseClient = createClient(url, serviceKey);
  const userA = createClient(url, key); const userB = createClient(url, key);
  const password = 'Finance-RLS-Test-1!'; const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailA = `finance-a-${stamp}@example.com`; const emailB = `finance-b-${stamp}@example.com`;
  let userAId = ''; let userBId = ''; let householdA = '';
  const cases: TableCase[] = [];

  beforeAll(async () => {
    const [createdA, createdB] = await Promise.all([
      admin.auth.admin.createUser({ email: emailA, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: emailB, password, email_confirm: true }),
    ]);
    if (createdA.error || !createdA.data.user) throw createdA.error; if (createdB.error || !createdB.data.user) throw createdB.error;
    userAId = createdA.data.user.id; userBId = createdB.data.user.id;
    const { data: households, error: householdError } = await admin.from('households').insert([
      { owner_user_id: userAId, name: 'Finance A' }, { owner_user_id: userBId, name: 'Finance B' },
    ]).select('id, owner_user_id');
    if (householdError) throw householdError;
    householdA = households!.find((h) => h.owner_user_id === userAId)!.id;
    expect(households!.some((h) => h.owner_user_id === userBId)).toBe(true);
    const [{ error: signInA }, { error: signInB }] = await Promise.all([
      userA.auth.signInWithPassword({ email: emailA, password }), userB.auth.signInWithPassword({ email: emailB, password }),
    ]);
    expect(signInA).toBeNull(); expect(signInB).toBeNull();

    const account = await insert('accounts', { household_id: householdA, bank_name: '은행', account_name: '계좌', account_type: 'checking', current_balance: 1_000_000 });
    cases.push({ table: 'accounts', id: account.id, spoof: { household_id: householdA, bank_name: 'B', account_name: 'B', account_type: 'checking' }, update: { memo: 'B update' } });
    const deposit = await insert('deposits', { household_id: householdA, bank_name: '은행', product_name: '예금', joined_at: '2026-01-01', maturity_date: '2026-12-31', principal: 1_000_000, annual_rate: 0.03 });
    cases.push({ table: 'deposits', id: deposit.id, spoof: { household_id: householdA, bank_name: 'B', product_name: 'B', joined_at: '2026-01-01', maturity_date: '2026-12-31', principal: 1, annual_rate: 0 }, update: { memo: 'B update' } });
    const savings = await insert('savings_accounts', { household_id: householdA, bank_name: '은행', product_name: '적금', joined_at: '2026-01-01', maturity_date: '2026-12-31', monthly_amount: 100_000, annual_rate: 0.03 });
    cases.push({ table: 'savings_accounts', id: savings.id, spoof: { household_id: householdA, bank_name: 'B', product_name: 'B', joined_at: '2026-01-01', maturity_date: '2026-12-31', monthly_amount: 1, annual_rate: 0 }, update: { memo: 'B update' } });
    const loan = await insert('loans', { household_id: householdA, institution_name: '은행', loan_name: '대출', original_amount: 1_200_000, annual_rate: 0, repayment_method: 'equal_principal', loan_date: '2025-12-01', first_payment_date: '2026-01-01', maturity_date: '2026-12-01' });
    cases.push({ table: 'loans', id: loan.id, spoof: { household_id: householdA, institution_name: 'B', loan_name: 'B', original_amount: 1, annual_rate: 0, repayment_method: 'bullet', loan_date: '2026-01-01', first_payment_date: '2026-02-01', maturity_date: '2026-03-01' }, update: { memo: 'B update' } });
    const payment = await insert('loan_payments', { household_id: householdA, loan_id: loan.id, installment: 1, payment_date: '2026-01-01', principal_payment: 100_000, interest_payment: 0, total_payment: 100_000, cumulative_payment: 100_000, remaining_balance: 1_100_000 });
    cases.push({ table: 'loan_payments', id: payment.id, spoof: { household_id: householdA, loan_id: loan.id, installment: 2, payment_date: '2026-02-01', principal_payment: 1, interest_payment: 0, total_payment: 1, cumulative_payment: 1, remaining_balance: 0 }, update: { memo: 'B update' } });
    const insurance = await insert('insurances', { household_id: householdA, insurer_name: '보험사', insurance_type: '실비', product_name: '보험', joined_at: '2026-01-01', monthly_premium: 0 });
    cases.push({ table: 'insurances', id: insurance.id, spoof: { household_id: householdA, insurer_name: 'B', insurance_type: 'B', product_name: 'B', joined_at: '2026-01-01', monthly_premium: 0 }, update: { memo: 'B update' } });
    const asset = await insert('assets', { household_id: householdA, asset_name: '자동차', asset_type: 'car', current_value: 10_000_000, valuation_date: '2026-08-29' });
    cases.push({ table: 'assets', id: asset.id, spoof: { household_id: householdA, asset_name: 'B', asset_type: 'other', current_value: 0, valuation_date: '2026-08-29' }, update: { memo: 'B update' } });
    const snapshot = await insert('monthly_asset_snapshots', { household_id: householdA, snapshot_month: '2026-08-01', cash_assets: 1, deposit_assets: 2, savings_assets: 3, investment_assets: 0, non_financial_assets: 4, total_assets: 10, total_debt: 5, net_worth: 5 });
    cases.push({ table: 'monthly_asset_snapshots', id: snapshot.id, spoof: { household_id: householdA, snapshot_month: '2026-09-01', cash_assets: 0, deposit_assets: 0, savings_assets: 0, investment_assets: 0, non_financial_assets: 0, total_assets: 0, total_debt: 0, net_worth: 0 }, update: { net_worth: 999 } });
  }, 30_000);

  afterAll(async () => { await Promise.allSettled([userAId, userBId].filter(Boolean).map((id) => admin.auth.admin.deleteUser(id))); });

  async function insert(table: string, row: Record<string, unknown>): Promise<{ id: string }> { const { data, error } = await userA.from(table).insert(row).select('id').single(); if (error || !data) throw error ?? new Error(`failed ${table}`); return data; }

  it('allows the owner to read every finance row', async () => {
    for (const entry of cases) { const { data, error } = await userA.from(entry.table).select('id').eq('id', entry.id).single(); expect(error, entry.table).toBeNull(); expect(data?.id).toBe(entry.id); }
  });
  it('hides every finance row from another authenticated household', async () => {
    for (const entry of cases) { const { data, error } = await userB.from(entry.table).select('id').eq('id', entry.id); expect(error, entry.table).toBeNull(); expect(data, entry.table).toEqual([]); }
  });
  it('blocks spoofed inserts and updates from another household', async () => {
    for (const entry of cases) { const { error: insertError } = await userB.from(entry.table).insert(entry.spoof); expect(insertError, `${entry.table} insert`).not.toBeNull(); const { data, error: updateError } = await userB.from(entry.table).update(entry.update).eq('id', entry.id).select('id'); expect(updateError, `${entry.table} update`).toBeNull(); expect(data, entry.table).toEqual([]); }
  });
  it('denies hard delete even to the owner', async () => {
    for (const entry of cases) { await userA.from(entry.table).delete().eq('id', entry.id); const { data } = await admin.from(entry.table).select('id').eq('id', entry.id).single(); expect(data?.id, entry.table).toBe(entry.id); }
  });
});
