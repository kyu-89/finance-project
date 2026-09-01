'use server';
import { revalidatePath } from 'next/cache';
import { createHouseholdMember, getCurrentHouseholdId, updateHouseholdMember, updateHouseholdMemberStatus, type HouseholdMember } from '@/lib/household';
import { fail, ok, type ActionResult } from '@/lib/action-result';
const TYPES: HouseholdMember['memberType'][] = ['self', 'spouse', 'child', 'other'];
const refresh = () => { revalidatePath('/settings'); revalidatePath('/dashboard'); revalidatePath('/finance'); revalidatePath('/monthly'); };
export async function createHouseholdMemberAction(_p: ActionResult, f: FormData): Promise<ActionResult> { const name = String(f.get('displayName') ?? '').trim(); const type = String(f.get('memberType') ?? '') as HouseholdMember['memberType']; if (!name || !TYPES.includes(type)) return fail('구성원 이름과 유형을 확인해 주세요.'); try { await createHouseholdMember({ householdId: await getCurrentHouseholdId(), displayName: name, memberType: type }); } catch (e) { return fail(e instanceof Error ? e.message : '구성원 추가에 실패했어요.'); } refresh(); return ok('구성원을 추가했어요.'); }
export async function updateHouseholdMemberAction(_p: ActionResult, f: FormData): Promise<ActionResult> { const id = String(f.get('id') ?? ''); const name = String(f.get('displayName') ?? '').trim(); const type = String(f.get('memberType') ?? '') as HouseholdMember['memberType']; const active = f.get('isActive') === 'on'; if (!id || !name || !TYPES.includes(type)) return fail('구성원 정보를 확인해 주세요.'); try { await updateHouseholdMember({ id, displayName: name, memberType: type, isActive: active || type === 'self' }); } catch (e) { return fail(e instanceof Error ? e.message : '구성원 수정에 실패했어요.'); } refresh(); return ok('구성원 정보를 저장했어요.'); }
export async function updateHouseholdMemberStatusAction(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = String(f.get('id') ?? ''); const raw = String(f.get('isActive') ?? '');
  if (!id || !['true', 'false'].includes(raw)) return fail('상태를 확인해 주세요.');
  try { await updateHouseholdMemberStatus({ id, householdId: await getCurrentHouseholdId(), isActive: raw === 'true' }); }
  catch (e) { return fail(e instanceof Error ? e.message : '구성원 상태 변경에 실패했습니다.'); }
  refresh(); return ok('구성원 상태를 변경했습니다.');
}
