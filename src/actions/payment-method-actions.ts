'use server';

import { revalidatePath } from 'next/cache';
import { createPaymentMethod, deactivatePaymentMethod } from '@/lib/payment-methods';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { fail, ok, type ActionResult } from '@/lib/action-result';

export async function createPaymentMethodAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const household = await ensureHouseholdForCurrentUser();
  const name = String(formData.get('name') ?? '').trim();
  const methodType = String(formData.get('methodType') ?? 'other') as
    | 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';

  if (!name) {
    return fail('결제수단 이름을 입력해주세요.');
  }

  try {
    await createPaymentMethod({ householdId: household.id, name, methodType });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

  revalidatePath('/settings/payment-methods');
  return ok();
}

export async function deactivatePaymentMethodAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return fail('결제수단 id가 없습니다.');
  }

  try {
    await deactivatePaymentMethod(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

  revalidatePath('/settings/payment-methods');
  return ok();
}
