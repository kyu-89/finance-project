'use server';

import { revalidatePath } from 'next/cache';
import {
  createCategory,
  createSubcategory,
  deactivateCategory,
  deactivateSubcategory,
  updateCategory,
  updateSubcategory,
} from '@/lib/categories';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { fail, ok, type ActionResult } from '@/lib/action-result';

export async function createCategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const household = await ensureHouseholdForCurrentUser();
  const name = String(formData.get('name') ?? '').trim();
  const transactionType = formData.get('transactionType') === 'income' ? 'income' : 'expense';
  const defaultCostBehaviorRaw = formData.get('defaultCostBehavior');
  const defaultCostBehavior =
    defaultCostBehaviorRaw === 'fixed' || defaultCostBehaviorRaw === 'variable' ? defaultCostBehaviorRaw : null;

  if (!name) {
    return fail('카테고리 이름을 입력해주세요.');
  }

  try {
    await createCategory({ householdId: household.id, transactionType, name, defaultCostBehavior });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function deactivateCategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return fail('카테고리 id가 없습니다.');
  }

  try {
    await deactivateCategory(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function updateCategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const raw = formData.get('defaultCostBehavior');
  const defaultCostBehavior = raw === 'fixed' || raw === 'variable' ? raw : null;

  if (!id) {
    return fail('카테고리 id가 없습니다.');
  }
  if (!name) {
    return fail('카테고리 이름을 입력해주세요.');
  }

  try {
    await updateCategory({ id, name, defaultCostBehavior });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '카테고리 수정에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function createSubcategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const categoryId = String(formData.get('categoryId') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!categoryId) {
    return fail('대분류를 선택해주세요.');
  }
  if (!name) {
    return fail('소분류 이름을 입력해주세요.');
  }

  try {
    await createSubcategory({ categoryId, name });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '소분류 생성에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function updateSubcategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!id) {
    return fail('소분류 id가 없습니다.');
  }
  if (!name) {
    return fail('소분류 이름을 입력해주세요.');
  }

  try {
    await updateSubcategory({ id, name });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '소분류 수정에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function deactivateSubcategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return fail('소분류 id가 없습니다.');
  }

  try {
    await deactivateSubcategory(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '소분류 비활성화에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}
