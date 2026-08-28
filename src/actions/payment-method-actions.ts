'use server';

import { revalidatePath } from 'next/cache';
import { createPaymentMethod, deactivatePaymentMethod } from '@/lib/payment-methods';
import { ensureHouseholdForCurrentUser } from '@/lib/household';

export async function createPaymentMethodAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();
  const name = String(formData.get('name') ?? '').trim();
  const methodType = String(formData.get('methodType') ?? 'other') as
    | 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';

  if (!name) {
    throw new Error('결제수단 이름을 입력해주세요.');
  }

  await createPaymentMethod({ householdId: household.id, name, methodType });
  revalidatePath('/settings/payment-methods');
}

export async function deactivatePaymentMethodAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    throw new Error('결제수단 id가 없습니다.');
  }
  await deactivatePaymentMethod(id);
  revalidatePath('/settings/payment-methods');
}
