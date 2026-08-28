import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function randomTestEmail(label: string) {
  return `sprint0-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('households/household_members RLS', () => {
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let userAId: string;
  let userBId: string;
  let userAHouseholdId: string;
  const userAEmail = randomTestEmail('a');
  const userBEmail = randomTestEmail('b');
  const password = 'Sprint0-Test-Password-1!';

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
  });

  afterAll(async () => {
    // Deleting the auth users cascades to households (FK on delete cascade),
    // which cascades to household_members.
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  it('lets a user create and read their own household', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    const { data: inserted, error: insertError } = await asUserA
      .from('households')
      .insert({ owner_user_id: userAId, name: 'A네 집' })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(inserted?.id).toBeTruthy();
    userAHouseholdId = inserted!.id;

    const { data: selected, error: selectError } = await asUserA
      .from('households')
      .select('id, name')
      .eq('id', userAHouseholdId)
      .maybeSingle();

    expect(selectError).toBeNull();
    expect(selected?.name).toBe('A네 집');
  });

  it("hides user A's household from user B", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    await asUserB.auth.signInWithPassword({ email: userBEmail, password });

    const { data: selected, error: selectError } = await asUserB
      .from('households')
      .select('id')
      .eq('id', userAHouseholdId);

    expect(selectError).toBeNull();
    expect(selected).toEqual([]);
  });

  it('blocks user B from spoofing an insert with owner_user_id = user A', async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    await asUserB.auth.signInWithPassword({ email: userBEmail, password });

    const { error: insertError } = await asUserB
      .from('households')
      .insert({ owner_user_id: userAId, name: '스푸핑 시도' });

    expect(insertError).not.toBeNull();
  });

  it("blocks user B from updating user A's household", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    await asUserB.auth.signInWithPassword({ email: userBEmail, password });

    const { data: updated, error: updateError } = await asUserB
      .from('households')
      .update({ name: '해킹당함' })
      .eq('id', userAHouseholdId)
      .select('id');

    expect(updateError).toBeNull();
    expect(updated).toEqual([]);
  });
});
