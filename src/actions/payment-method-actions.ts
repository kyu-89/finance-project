'use server';

import { revalidatePath } from 'next/cache';
import { createPaymentMethod, deactivatePaymentMethod, setPaymentMethodActive } from '@/lib/payment-methods';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { getCurrentHouseholdId } from '@/lib/household';
import { fail, ok, type ActionResult } from '@/lib/action-result';

export async function createPaymentMethodAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const methodType = String(formData.get('methodType') ?? 'other') as
    | 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';
  const providerName = String(formData.get('providerName') ?? '').trim() || null;
  const accountNumber = String(formData.get('accountNumber') ?? '').replace(/\D/g, '') || null;
  const rawCardNumber = String(formData.get('cardNumber') ?? '').replace(/\D/g, '');
  const cardNumberLast4 = rawCardNumber ? rawCardNumber.slice(-4) : null;
  const expiresAt = String(formData.get('expiresAt') ?? '').trim() || null;

  if (!name) {
    return fail('결제수단 이름을 입력해주세요.');
  }

  try {
    const household = await ensureHouseholdForCurrentUser();
    await createPaymentMethod({ householdId: household.id, name, methodType, providerName, accountNumber, cardNumberLast4, expiresAt });
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
    await deactivatePaymentMethod(id, await getCurrentHouseholdId());
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

  revalidatePath('/settings/payment-methods');
  return ok('결제수단을 사용하지 않도록 바꿨어요.');
}

export async function setPaymentMethodActiveAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? ''); const raw = String(formData.get('isActive') ?? '');
  if (!id || !['true', 'false'].includes(raw)) return fail('상태를 확인해 주세요.');
  try { await setPaymentMethodActive(id, await getCurrentHouseholdId(), raw === 'true'); }
  catch (error) { return fail(error instanceof Error ? error.message : '결제수단 상태 변경에 실패했습니다.'); }
  revalidatePath('/settings/payment-methods'); return ok('결제수단 상태를 변경했습니다.');
}
