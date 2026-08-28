import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function randomTestEmail(label: string) {
  return `sprint1-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('categories/payment_methods/transactions RLS', () => {
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let userAId: string;
  let userBId: string;
  let userAHouseholdId: string;
  let userACategoryId: string;
  let userAPaymentMethodId: string;
  let userATransactionId: string;
  const userAEmail = randomTestEmail('a');
  const userBEmail = randomTestEmail('b');
  const password = 'Sprint1-Test-Password-1!';

  beforeAll(async () => {
    const { data: userAData, error: userAError } = await admin.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (userAError || !userAData.user) throw userAError ?? new Error('failed to create user A');
    userAId = userAData.user.id;

    const { data: userBData, error: userBError } = await admin.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (userBError || !userBData.user) throw userBError ?? new Error('failed to create user B');
    userBId = userBData.user.id;

    const { data: household, error: householdError } = await admin
      .from('households')
      .insert({ owner_user_id: userAId, name: 'A네 집' })
      .select('id')
      .single();
    if (householdError || !household) throw householdError ?? new Error('failed to create household');
    userAHouseholdId = household.id;
  });

  afterAll(async () => {
    // Deleting the auth users cascades to households (FK on delete cascade), which cascades to
    // categories/payment_methods/transactions. Isolate each delete so one failure doesn't block
    // cleanup of the other user, and skip ids that were never assigned (e.g. user A's createUser
    // succeeded but user B's threw in beforeAll).
    const results = await Promise.allSettled(
      [userAId, userBId].filter((id): id is string => Boolean(id)).map((id) => admin.auth.admin.deleteUser(id)),
    );
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('RLS test cleanup failed for one or more users:', failures.map((f) => f.reason));
    }
  });

  it('lets user A create a category in their own household', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({ email: userAEmail, password });
    expect(signInError).toBeNull();

    const { data: category, error: categoryError } = await asUserA
      .from('categories')
      .insert({ household_id: userAHouseholdId, transaction_type: 'expense', name: '테스트 카테고리' })
      .select('id')
      .single();

    expect(categoryError).toBeNull();
    expect(category?.id).toBeTruthy();
    userACategoryId = category!.id;
  });

  it("hides user A's category from user B", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    // Every categories policy is scoped `to authenticated` with no anon grants -- if this sign-in
    // silently failed, the assertions below would pass vacuously as an anon-role denial instead of
    // proving owner-scoped RLS actually blocks a real second authenticated user.
    expect(signInError).toBeNull();

    const { data: selected, error: selectError } = await asUserB
      .from('categories')
      .select('id')
      .eq('id', userACategoryId);

    expect(selectError).toBeNull();
    expect(selected).toEqual([]);
  });

  it("blocks user B from updating user A's category", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { data: updated, error: updateError } = await asUserB
      .from('categories')
      .update({ name: '해킹당함' })
      .eq('id', userACategoryId)
      .select('id');

    // RLS silently filters the row out of the update's WHERE clause -- no error, zero rows affected.
    expect(updateError).toBeNull();
    expect(updated).toEqual([]);
  });

  it('lets user A create a payment method in their own household', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({ email: userAEmail, password });
    expect(signInError).toBeNull();

    const { data: paymentMethod, error: paymentMethodError } = await asUserA
      .from('payment_methods')
      .insert({ household_id: userAHouseholdId, name: '테스트 카드', method_type: 'credit_card' })
      .select('id')
      .single();

    expect(paymentMethodError).toBeNull();
    expect(paymentMethod?.id).toBeTruthy();
    userAPaymentMethodId = paymentMethod!.id;
  });

  it("hides user A's payment method from user B", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { data: selected, error: selectError } = await asUserB
      .from('payment_methods')
      .select('id')
      .eq('id', userAPaymentMethodId);

    expect(selectError).toBeNull();
    expect(selected).toEqual([]);
  });

  it("blocks user B from spoofing an insert into user A's payment methods", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { error: insertError } = await asUserB
      .from('payment_methods')
      .insert({ household_id: userAHouseholdId, name: '스푸핑 결제수단', method_type: 'other' });

    expect(insertError).not.toBeNull();
  });

  it("blocks user B from inserting a transaction into A's household", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { error: insertError } = await asUserB.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      amount: 10000,
      description: '스푸핑 시도',
    });

    expect(insertError).not.toBeNull();
  });

  it('lets user A insert and read their own transaction, enforcing amount > 0', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({ email: userAEmail, password });
    expect(signInError).toBeNull();

    const { error: invalidAmountError } = await asUserA.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      amount: 0,
      description: '0원 거래 시도',
    });
    expect(invalidAmountError).not.toBeNull();

    const { data: inserted, error: insertError } = await asUserA
      .from('transactions')
      .insert({
        household_id: userAHouseholdId,
        transaction_date: '2026-08-28',
        transaction_type: 'expense',
        flow_class: 'consumption',
        category_id: userACategoryId,
        payment_method_id: userAPaymentMethodId,
        amount: 35000,
        description: '외식',
      })
      .select('id, amount, status')
      .single();

    expect(insertError).toBeNull();
    expect(inserted?.amount).toBe(35000);
    expect(inserted?.status).toBe('posted'); // default
    userATransactionId = inserted!.id;
  });

  it("hides user A's transaction from user B", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { data: selected, error: selectError } = await asUserB
      .from('transactions')
      .select('id')
      .eq('id', userATransactionId);

    expect(selectError).toBeNull();
    expect(selected).toEqual([]);
  });

  it("blocks user B from updating user A's transaction", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { data: updated, error: updateError } = await asUserB
      .from('transactions')
      .update({ description: '해킹당함' })
      .eq('id', userATransactionId)
      .select('id');

    expect(updateError).toBeNull();
    expect(updated).toEqual([]);
  });

  it("blocks user B from deleting user A's transaction", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { data: deleted, error: deleteError } = await asUserB
      .from('transactions')
      .delete()
      .eq('id', userATransactionId)
      .select('id');

    // No delete policy exists on transactions at all (PRD §5.4 -- 30-day soft-delete
    // recoverability), so this is denied by default under RLS: no error, zero rows affected.
    expect(deleteError).toBeNull();
    expect(deleted).toEqual([]);
  });

  it("denies even the owner a hard delete on their own transaction, since no delete policy exists", async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({ email: userAEmail, password });
    expect(signInError).toBeNull();

    const { data: deleted, error: deleteError } = await asUserA
      .from('transactions')
      .delete()
      .eq('id', userATransactionId)
      .select('id');

    // Table has zero delete policies (dropped in migration 20260829020100), so RLS denies DELETE
    // by default for every authenticated caller -- including the household's own owner. Soft
    // delete (UPDATE deleted_at) is the only deletion path; this proves hard delete is unreachable
    // even via a direct SDK call, not merely avoided by app-layer discipline.
    expect(deleteError).toBeNull();
    expect(deleted).toEqual([]);

    const { data: stillThere, error: verifyError } = await admin
      .from('transactions')
      .select('id, deleted_at')
      .eq('id', userATransactionId)
      .single();

    expect(verifyError).toBeNull();
    expect(stillThere?.id).toBe(userATransactionId);
    expect(stillThere?.deleted_at).toBeNull();
  });

  it('hides a soft-deleted transaction from its own owner (PRD §5.4)', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    const { data: inserted, error: insertError } = await asUserA
      .from('transactions')
      .insert({
        household_id: userAHouseholdId,
        transaction_date: '2026-08-28',
        transaction_type: 'expense',
        flow_class: 'consumption',
        category_id: userACategoryId,
        amount: 5000,
        description: '소프트 삭제 대상',
      })
      .select('id')
      .single();
    expect(insertError).toBeNull();

    // Visible before deletion.
    const { data: before } = await asUserA
      .from('transactions')
      .select('id')
      .eq('id', inserted!.id)
      .is('deleted_at', null);
    expect(before).toHaveLength(1);

    const { error: softDeleteError } = await asUserA
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', inserted!.id);
    expect(softDeleteError).toBeNull();

    // Gone from the app's read path...
    const { data: after } = await asUserA
      .from('transactions')
      .select('id')
      .eq('id', inserted!.id)
      .is('deleted_at', null);
    expect(after).toEqual([]);

    // ...but the row itself still exists, which is what makes 30-day recovery possible.
    const { data: stillThere } = await admin
      .from('transactions')
      .select('id, deleted_at')
      .eq('id', inserted!.id)
      .single();
    expect(stillThere?.id).toBe(inserted!.id);
    expect(stillThere?.deleted_at).not.toBeNull();
  });

  it("rejects a transaction referencing another household's category", async () => {
    // Build a second household owned by user B, with its own category.
    const { data: householdB, error: householdBError } = await admin
      .from('households')
      .insert({ owner_user_id: userBId, name: 'B네 집' })
      .select('id')
      .single();
    expect(householdBError).toBeNull();

    const { data: categoryB, error: categoryBError } = await admin
      .from('categories')
      .insert({ household_id: householdB!.id, transaction_type: 'expense', name: 'B의 카테고리' })
      .select('id')
      .single();
    expect(categoryBError).toBeNull();

    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    // User A inserts into their OWN household (so RLS permits it) but points category_id
    // at user B's category. RLS alone would allow this; the tenant-check trigger must not.
    const { error: crossTenantError } = await asUserA.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      category_id: categoryB!.id,
      amount: 1000,
      description: '교차 테넌트 FK 시도',
    });

    expect(crossTenantError).not.toBeNull();
  });

  it('rejects a subcategory that does not belong to the given category', async () => {
    const { data: otherCategory, error: otherCategoryError } = await admin
      .from('categories')
      .insert({ household_id: userAHouseholdId, transaction_type: 'expense', name: '다른 카테고리' })
      .select('id')
      .single();
    expect(otherCategoryError).toBeNull();

    const { data: otherSub, error: otherSubError } = await admin
      .from('subcategories')
      .insert({ category_id: otherCategory!.id, name: '다른 소분류' })
      .select('id')
      .single();
    expect(otherSubError).toBeNull();

    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    // Same household (so the tenant check passes) but the subcategory belongs to a
    // different category — the subcategory-consistency trigger must reject it.
    const { error: mismatchError } = await asUserA.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      category_id: userACategoryId,
      subcategory_id: otherSub!.id,
      amount: 1000,
      description: '소분류 불일치 시도',
    });

    expect(mismatchError).not.toBeNull();
  });
});
