import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { ensureDefaultCategoriesSeeded } from '@/lib/categories';
import { ensureDefaultPaymentMethodsSeeded } from '@/lib/payment-methods';

export type Household = {
  id: string;
  ownerUserId: string;
  name: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const UNIQUE_VIOLATION = '23505';

export async function ensureHouseholdForCurrentUser(): Promise<Household> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인이 필요합니다.');
  }

  let household = await selectHousehold(supabase, user.id);

  if (!household) {
    const { data: inserted, error: insertError } = await supabase
      .from('households')
      .insert({ owner_user_id: user.id, name: '우리집' })
      .select('id, owner_user_id, name')
      .single();

    if (insertError) {
      // Lost a concurrent create race: another request already inserted this user's
      // household between our SELECT and our INSERT (blocked by the unique index on
      // owner_user_id from Task 4). From the caller's perspective this is success, not
      // an error — fall back to re-reading the row the winner created.
      if (insertError.code === UNIQUE_VIOLATION) {
        household = await selectHousehold(supabase, user.id);
        if (!household) {
          throw new Error(`가구 생성 후 재조회 실패: ${insertError.message}`);
        }
      } else {
        throw new Error(`가구 생성 실패: ${insertError.message}`);
      }
    } else {
      household = { id: inserted.id, ownerUserId: inserted.owner_user_id, name: inserted.name };
    }
  }

  await ensureSelfMember(supabase, household.id);
  await ensureDefaultCategoriesSeeded(household.id);
  await ensureDefaultPaymentMethodsSeeded(household.id);

  return household;
}

async function selectHousehold(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Household | null> {
  const { data, error } = await supabase
    .from('households')
    .select('id, owner_user_id, name')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`가구 조회 실패: ${error.message}`);
  }

  return data ? { id: data.id, ownerUserId: data.owner_user_id, name: data.name } : null;
}

async function ensureSelfMember(supabase: SupabaseServerClient, householdId: string): Promise<void> {
  const { data: existingMember, error: selectError } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('member_type', 'self')
    .maybeSingle();

  if (selectError) {
    throw new Error(`기본 구성원 조회 실패: ${selectError.message}`);
  }

  if (existingMember) {
    return;
  }

  const { error: memberError } = await supabase.from('household_members').insert({
    household_id: householdId,
    member_type: 'self',
    display_name: '본인',
  });

  if (memberError) {
    // household_members has no unique constraint on (household_id, member_type) yet
    // (tracked as a follow-up), so we can't tell a concurrent-insert race apart from a
    // real failure by error code alone. Re-check presence before treating it as fatal —
    // if a row now exists (this insert's own race partner won), we recovered; otherwise
    // this is a genuine, un-self-healed failure and the caller needs to know.
    const { data: recheck } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .eq('member_type', 'self')
      .maybeSingle();

    if (!recheck) {
      throw new Error(`기본 구성원 생성 실패: ${memberError.message}`);
    }
  }
}
