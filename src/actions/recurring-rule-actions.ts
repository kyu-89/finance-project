'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import {
  createRecurringRule,
  updateRecurringRuleStatus,
  updateRecurringRuleAmount,
  addRecurringPausePeriod,
  updateRecurringRuleDay,
  type RecurringRuleStatus,
  type RecurringSourceType,
} from '@/lib/recurring-rules';
import type { TransactionType } from '@/lib/cost-behavior';
import type { RecurrenceFrequency } from '@/lib/recurrence';
import { todayInSeoul } from '@/lib/date';

const TRANSACTION_TYPES = new Set<TransactionType>([
  'income', 'expense', 'saving', 'investment', 'debt_principal',
  'finance_cost', 'transfer', 'asset_adjustment', 'refund',
]);
const FREQUENCIES = new Set<RecurrenceFrequency>(['monthly', 'weekly', 'yearly', 'custom']);
const SOURCE_TYPES = new Set<RecurringSourceType>([
  'insurance', 'saving', 'loan', 'subscription', 'salary', 'manual',
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function optionalId(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? '').trim();
  return value || null;
}

export async function createRecurringRuleAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const description = String(formData.get('description') ?? '').trim();
  const amount = Number(formData.get('amount'));
  const startDate = String(formData.get('startDate') ?? '');
  const endDate = String(formData.get('endDate') ?? '') || null;
  const transactionType = String(formData.get('transactionType')) as TransactionType;
  const frequency = String(formData.get('frequency')) as RecurrenceFrequency;
  const sourceType = String(formData.get('sourceType')) as RecurringSourceType;
  const intervalCount = Number(formData.get('intervalCount'));
  const rawDay = String(formData.get('dayOfMonth') ?? '');
  const dayOfMonth = rawDay ? Number(rawDay) : null;
  const rawCostBehavior = formData.get('costBehavior');
  const costBehavior = rawCostBehavior === 'fixed' || rawCostBehavior === 'variable'
    ? rawCostBehavior
    : null;

  if (!description) return fail('반복항목 이름을 입력해 주세요.');
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail('금액은 0보다 큰 원 단위 정수여야 해요.');
  if (!DATE_PATTERN.test(startDate) || (endDate && !DATE_PATTERN.test(endDate))) return fail('날짜를 확인해 주세요.');
  if (endDate && endDate < startDate) return fail('종료일은 시작일보다 빠를 수 없어요.');
  if (!TRANSACTION_TYPES.has(transactionType)) return fail('거래 유형을 확인해 주세요.');
  if (!FREQUENCIES.has(frequency)) return fail('반복 주기를 확인해 주세요.');
  if (!SOURCE_TYPES.has(sourceType)) return fail('반복항목 종류를 확인해 주세요.');
  if (!Number.isInteger(intervalCount) || intervalCount < 1) return fail('반복 간격은 1 이상의 정수여야 해요.');
  if (frequency === 'monthly' && (!Number.isInteger(dayOfMonth) || dayOfMonth! < 1 || dayOfMonth! > 31)) {
    return fail('월 납부일은 1~31일 중에서 선택해 주세요.');
  }

  try {
    const household = await ensureHouseholdForCurrentUser();
    await createRecurringRule({
      householdId: household.id,
      sourceType,
      startDate,
      endDate,
      frequency,
      intervalCount,
      dayOfMonth,
      defaultAmount: amount,
      transactionType,
      costBehavior,
      categoryId: optionalId(formData, 'categoryId'),
      subcategoryId: optionalId(formData, 'subcategoryId'),
      paymentMethodId: optionalId(formData, 'paymentMethodId'),
      description,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '반복항목 생성에 실패했어요.');
  }

  revalidatePath('/settings/recurring');
  return ok();
}

export async function updateRecurringRuleStatusAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status')) as RecurringRuleStatus;
  if (!id || !new Set<RecurringRuleStatus>(['active', 'paused', 'ended']).has(status)) {
    return fail('반복항목 상태를 확인해 주세요.');
  }

  try {
    await updateRecurringRuleStatus(id, status);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '상태 변경에 실패했어요.');
  }

  revalidatePath('/settings/recurring');
  return ok();
}

export async function updateRecurringRuleAmountAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ruleId = String(formData.get('id') ?? '');
  const amount = Number(formData.get('amount'));
  if (!ruleId || !Number.isSafeInteger(amount) || amount <= 0) {
    return fail('금액은 0보다 큰 원 단위 정수여야 해요.');
  }
  try {
    await ensureHouseholdForCurrentUser();
    await updateRecurringRuleAmount({ ruleId, amount, effectiveDate: todayInSeoul() });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '반복 금액 변경에 실패했어요.');
  }
  revalidatePath('/settings/recurring');
  revalidatePath('/monthly');
  return ok();
}

export async function addRecurringPausePeriodAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ruleId = String(formData.get('id') ?? '');
  const startDate = String(formData.get('startDate') ?? '');
  const endDate = String(formData.get('endDate') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!ruleId || !DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) return fail('중지 기간을 확인해 주세요.');
  if (endDate < startDate) return fail('중지 종료일은 시작일보다 빠를 수 없어요.');
  try {
    await ensureHouseholdForCurrentUser();
    await addRecurringPausePeriod({ ruleId, startDate, endDate, reason });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '일시중지 기간 추가에 실패했어요.');
  }
  revalidatePath('/settings/recurring');
  revalidatePath('/monthly');
  return ok();
}

export async function updateRecurringRuleDayAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ruleId = String(formData.get('id') ?? '');
  const dayOfMonth = Number(formData.get('dayOfMonth'));
  if (!ruleId || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return fail('월 납부일은 1~31일 중에서 선택해 주세요.');
  }
  try {
    await ensureHouseholdForCurrentUser();
    await updateRecurringRuleDay(ruleId, dayOfMonth);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '월 납부일 변경에 실패했어요.');
  }
  revalidatePath('/settings/recurring');
  return ok();
}
