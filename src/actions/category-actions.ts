'use server';

import { revalidatePath } from 'next/cache';
import { createCategory, deactivateCategory } from '@/lib/categories';
import { ensureHouseholdForCurrentUser } from '@/lib/household';

export async function createCategoryAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();
  const name = String(formData.get('name') ?? '').trim();
  const transactionType = formData.get('transactionType') === 'income' ? 'income' : 'expense';
  const defaultCostBehaviorRaw = formData.get('defaultCostBehavior');
  const defaultCostBehavior =
    defaultCostBehaviorRaw === 'fixed' || defaultCostBehaviorRaw === 'variable' ? defaultCostBehaviorRaw : null;

  if (!name) {
    throw new Error('카테고리 이름을 입력해주세요.');
  }

  await createCategory({ householdId: household.id, transactionType, name, defaultCostBehavior });
  revalidatePath('/settings/categories');
}

export async function deactivateCategoryAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    throw new Error('카테고리 id가 없습니다.');
  }
  await deactivateCategory(id);
  revalidatePath('/settings/categories');
}
