'use server';

import { createClient } from '@/lib/supabase/server';

export type Household = {
  id: string;
  ownerUserId: string;
  name: string;
};

export async function ensureHouseholdForCurrentUser(): Promise<Household> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인이 필요합니다.');
  }

  const { data: existing, error: selectError } = await supabase
    .from('households')
    .select('id, owner_user_id, name')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(`가구 조회 실패: ${selectError.message}`);
  }

  if (existing) {
    return { id: existing.id, ownerUserId: existing.owner_user_id, name: existing.name };
  }

  const { data: household, error: insertError } = await supabase
    .from('households')
    .insert({ owner_user_id: user.id, name: '우리집' })
    .select('id, owner_user_id, name')
    .single();

  if (insertError) {
    throw new Error(`가구 생성 실패: ${insertError.message}`);
  }

  const { error: memberError } = await supabase.from('household_members').insert({
    household_id: household.id,
    member_type: 'self',
    display_name: '본인',
  });

  if (memberError) {
    throw new Error(`기본 구성원 생성 실패: ${memberError.message}`);
  }

  return { id: household.id, ownerUserId: household.owner_user_id, name: household.name };
}
