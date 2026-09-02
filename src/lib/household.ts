import 'server-only';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { ensureDefaultCategoriesSeeded } from '@/lib/categories';
import { ensureDefaultPaymentMethodsSeeded } from '@/lib/payment-methods';

export type Household = {
  id: string;
  ownerUserId: string;
  name: string;
  initializedAt: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const UNIQUE_VIOLATION = '23505';

// Wrapped in React's cache() so every Server Component in a single request tree (the (app)
// layout AND whichever page it renders both call this) shares one in-flight execution instead
// of racing each other through the multi-step bootstrap/seeding sequence below — that same-
// request race was reproduced as a real transient 500 during Task 4's testing (two concurrent
// calls both seeing "no household yet" and racing on the seed inserts). Cross-request races
// (e.g. two literally simultaneous first-ever page loads in different tabs) remain handled by
// the unique-violation catch and the per-row resumable seeding below — cache() only dedupes
// within one request, it cannot and does not need to solve that separate, already-accepted
// residual risk.
export const ensureHouseholdForCurrentUser = cache(async (): Promise<Household> => {
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
      .select('id, owner_user_id, name, initialized_at')
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
      household = { id: inserted.id, ownerUserId: inserted.owner_user_id, name: inserted.name, initializedAt: inserted.initialized_at };
    }
  }

  // These three are independent of each other and, on an already-bootstrapped household,
  // are all no-op existence checks. Awaiting them in sequence made every single request pay
  // three serial Supabase round trips for nothing; running them together pays one.
  if (!household.initializedAt) {
    await Promise.all([
      ensureDefaultCategoriesSeeded(household.id),
      ensureDefaultPaymentMethodsSeeded(household.id),
    ]);
    const { error: initializedError } = await supabase.from('households').update({ initialized_at: new Date().toISOString() }).eq('id', household.id);
    if (initializedError) throw new Error(`가구 초기화 완료 처리 실패: ${initializedError.message}`);
  }

  return household;
});

// Hot path for Server Actions that only need to know WHICH household to write to.
// The full bootstrap above belongs to page rendering (the (app) layout runs it on every
// navigation); making a save re-run all of its seeding checks doubled the round trips on
// the one interaction PRD §5.1 wants to finish in seconds. Falls back to the full bootstrap
// only when no household exists yet, which cannot normally happen — reaching an action
// implies a page already rendered, and rendering bootstraps.
export const getCurrentHouseholdId = cache(async (): Promise<string> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인이 필요합니다.');
  }

  const household = await selectHousehold(supabase, user.id);
  if (household) {
    return household.id;
  }

  return (await ensureHouseholdForCurrentUser()).id;
});

async function selectHousehold(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Household | null> {
  const { data, error } = await supabase
    .from('households')
    .select('id, owner_user_id, name, initialized_at')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`가구 조회 실패: ${error.message}`);
  }

  return data ? { id: data.id, ownerUserId: data.owner_user_id, name: data.name, initializedAt: data.initialized_at } : null;
}
