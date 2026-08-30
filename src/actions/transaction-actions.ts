'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createTransaction,
  confirmPlannedTransaction,
  skipPlannedTransaction,
  undoTransaction,
  updateTransactionCostBehavior,
} from '@/lib/transactions';
import { getCurrentHouseholdId } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import type { TransactionType } from '@/lib/cost-behavior';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { linkRecurringOccurrence } from '@/lib/recurring-rules';

export async function createQuickTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const amount = Number(formData.get('amount'));
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const categoryDefaultCostBehavior = (formData.get('categoryDefaultCostBehavior') || null) as
    'fixed' | 'variable' | null;
  const subcategoryId = String(formData.get('subcategoryId') ?? '') || null;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  const description = String(formData.get('description') ?? '').trim();
  const memo = String(formData.get('memo') ?? '') || null;
  const transactionType = (formData.get('transactionType') as TransactionType) ?? 'expense';
  const rawCostBehavior = formData.get('costBehaviorOverride');
  const costBehaviorOverride =
    rawCostBehavior === 'fixed' || rawCostBehavior === 'variable' ? rawCostBehavior : null;

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return fail('금액은 1원 단위의 정수로 입력해주세요.');
  }
  if (!description) {
    return fail('내용을 입력해주세요.');
  }
  // PRD §5.1: 대분류→소분류→결제수단 are required entry steps. Without this, tapping 저장
  // before touching the pickers silently saves an uncategorized row (category_id/cost_behavior
  // both null), invisible to all category and 고정비/변동비 analysis. 소분류 stays optional —
  // some categories (e.g. 협찬) have only one meaningful choice.
  if (!categoryId) {
    return fail('대분류를 선택해주세요.');
  }
  if (!paymentMethodId) {
    return fail('결제수단을 선택해주세요.');
  }

  let created;
  try {
    const householdId = await getCurrentHouseholdId();
    created = await createTransaction({
      householdId,
      transactionDate: todayInSeoul(),
      transactionType,
      categoryId,
      categoryDefaultCostBehavior,
      costBehaviorOverride,
      subcategoryId,
      paymentMethodId,
      amount,
      description,
      memo,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '거래 저장에 실패했습니다.');
  }

  // Outside the try: redirect() signals by throwing, and catching it would break navigation.
  // A unique value per save (rather than a constant `1`) so consecutive saves each produce a
  // distinct URL — QuickAddForm keys its "saved" effect (confirmation banner + form reset) off
  // this value, and a same-segment navigation to an unchanged URL wouldn't re-trigger it.
  redirect(`/quick-add?saved=${Date.now()}&undo=${created.id}`);
}

export async function createMonthlyRowAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const amount = Number(formData.get('amount'));
  const transactionDate = String(formData.get('transactionDate') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const categoryDefaultCostBehavior = (formData.get('categoryDefaultCostBehavior') || null) as
    'fixed' | 'variable' | null;
  const subcategoryId = String(formData.get('subcategoryId') ?? '') || null;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  const transactionType = (formData.get('transactionType') as TransactionType) ?? 'expense';
  const rawCostBehavior = formData.get('costBehaviorOverride');
  const costBehaviorOverride =
    rawCostBehavior === 'fixed' || rawCostBehavior === 'variable' ? rawCostBehavior : null;

  if (!transactionDate) {
    return fail('날짜를 입력해주세요.');
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return fail('금액은 1원 단위의 정수로 입력해주세요.');
  }
  if (!description) {
    return fail('내용을 입력해주세요.');
  }

  try {
    const householdId = await getCurrentHouseholdId();
    await createTransaction({
      householdId,
      transactionDate,
      transactionType,
      categoryId,
      categoryDefaultCostBehavior,
      costBehaviorOverride,
      subcategoryId,
      paymentMethodId,
      amount,
      description,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

  revalidatePath('/monthly');
  return ok('지출 내역을 추가했어요.');
}

export async function undoTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return fail('취소할 거래 id가 없습니다.');
  }

  try {
    await getCurrentHouseholdId();
    await undoTransaction(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '취소에 실패했습니다.');
  }

  redirect('/quick-add?undone=1');
}

export async function deleteTransactionAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('삭제할 거래 id가 없습니다.');
  try { await getCurrentHouseholdId(); await undoTransaction(id); }
  catch (error) { return fail(error instanceof Error ? error.message : '거래 삭제에 실패했어요.'); }
  revalidatePath('/monthly'); revalidatePath('/dashboard');
  return ok('거래를 삭제했어요.');
}

export async function updateCostBehaviorAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const raw = formData.get('costBehavior');
  const costBehavior = raw === 'fixed' || raw === 'variable' ? raw : null;

  if (!id) {
    return fail('거래 id가 없습니다.');
  }

  try {
    await getCurrentHouseholdId();
    await updateTransactionCostBehavior(id, costBehavior);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '비용성격 수정에 실패했습니다.');
  }

  revalidatePath('/monthly');
  return ok();
}

export async function confirmPlannedTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const transactionDate = String(formData.get('transactionDate') ?? '');
  const amount = Number(formData.get('amount'));
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) return fail('거래 날짜를 확인해 주세요.');
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail('금액은 0보다 큰 원 단위 정수여야 해요.');

  try {
    await getCurrentHouseholdId();
    await confirmPlannedTransaction({ id, transactionDate, amount, paymentMethodId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '예정 거래 확정에 실패했어요.');
  }
  revalidatePath('/monthly');
  return ok();
}

export async function skipPlannedTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('거래 id가 없습니다.');
  try {
    await getCurrentHouseholdId();
    await skipPlannedTransaction(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '예정 거래 건너뛰기에 실패했어요.');
  }
  revalidatePath('/monthly');
  return ok();
}

export async function linkRecurringOccurrenceAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const occurrenceId = String(formData.get('occurrenceId') ?? '');
  const plannedTransactionId = String(formData.get('plannedTransactionId') ?? '');
  const postedTransactionId = String(formData.get('postedTransactionId') ?? '');
  if (!occurrenceId || !plannedTransactionId || !postedTransactionId) return fail('연결할 거래를 선택해 주세요.');

  try {
    await getCurrentHouseholdId();
    await linkRecurringOccurrence({ occurrenceId, plannedTransactionId, postedTransactionId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '기존 거래 연결에 실패했어요.');
  }
  revalidatePath('/monthly');
  return ok();
}
