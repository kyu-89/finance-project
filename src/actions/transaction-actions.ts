'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createTransaction,
  confirmPlannedTransaction,
  skipPlannedTransaction,
  undoTransaction,
  updateTransactionCostBehavior,
  restoreTransaction,
} from '@/lib/transactions';
import { getCurrentHouseholdId } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import type { TransactionType } from '@/lib/cost-behavior';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { linkRecurringOccurrence } from '@/lib/recurring-rules';
import { upsertEventDetail, upsertSupportDetail } from '@/lib/transaction-details';
import { createClient } from '@/lib/supabase/server';
import { duplicateTransactionKey } from '@/lib/duplicate-transactions';

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
  const accountId = String(formData.get('accountId') ?? '') || null;
  const payerMemberId = String(formData.get('payerMemberId') ?? '') || null;
  const beneficiaryMemberId = String(formData.get('beneficiaryMemberId') ?? '') || null;
  const tags = String(formData.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
  const incomeGroup = formData.get('incomeGroup') === 'fixed' || formData.get('incomeGroup') === 'additional' ? formData.get('incomeGroup') as 'fixed' | 'additional' : null;
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
  if ((transactionType === 'income' || transactionType === 'expense') && !categoryId) {
    return fail('대분류를 선택해주세요.');
  }
  if (transactionType === 'expense' && !paymentMethodId) {
    return fail('결제수단을 선택해주세요.');
  }
  // PRD §5.1: 대분류→소분류→결제수단 are required entry steps. Without this, tapping 저장
  // before touching the pickers silently saves an uncategorized row (category_id/cost_behavior
  // both null), invisible to all category and 고정비/변동비 analysis. 소분류 stays optional —
  // some categories (e.g. 협찬) have only one meaningful choice.
    // Categories are meaningful for income/expense analysis. Other quick-entry
    // types (saving, investment, transfer, loan principal, finance cost) may be
    // recorded without a category and are managed from their dedicated screens.
    if ((transactionType === 'income' || transactionType === 'expense') && !categoryId) {
      return fail('대분류를 선택해주세요.');
    }
  if (transactionType === 'expense' && !paymentMethodId) {
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
      accountId,
      payerMemberId,
      beneficiaryMemberId,
      tags,
      incomeGroup,
      amount,
      description,
      memo,
    });
    const supportKind = String(formData.get('supportKind') ?? '').trim();
    if (transactionType === 'income' && supportKind) {
      await upsertSupportDetail(householdId, { transactionId: created.id, supportKind, eligibility: null, applicationPeriod: null, receivingPeriod: null, payoutCycle: 'one_time', expectedDate: null, amountPerOccurrence: amount, totalExpectedAmount: amount, status: 'planned', issuer: null, contact: null, sourceUrl: null, beneficiaryMemberId: null, memo: null });
    }
    const eventType = String(formData.get('eventType') ?? '');
    if (transactionType === 'expense' && ['wedding', 'condolence', 'gift', 'other'].includes(eventType)) {
      await upsertEventDetail(householdId, { transactionId: created.id, eventType: eventType as 'wedding' | 'condolence' | 'gift' | 'other', counterparty: String(formData.get('counterparty') ?? '').trim() || null, relationshipGroup: String(formData.get('relationshipGroup') ?? '').trim() || null, eventDescription: String(formData.get('eventDescription') ?? '').trim() || null, relatedMemberId: null, memo: null });
    }
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
  const parentTransactionId = String(formData.get('parentTransactionId') ?? '') || null;
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
    if (transactionType === 'refund') {
      if (!parentTransactionId) return fail('환불할 원거래를 선택해 주세요.');
      const supabase = await createClient();
      const { data: parent, error: parentError } = await supabase.from('transactions').select('id, amount, transaction_type, flow_class, category_id, subcategory_id, payment_method_id, cost_behavior').eq('id', parentTransactionId).eq('household_id', householdId).is('deleted_at', null).single();
      if (parentError || !parent || parent.transaction_type !== 'expense' || parent.flow_class !== 'consumption') return fail('환불 원거래를 찾을 수 없어요.');
      const { data: refunds, error: refundsError } = await supabase.from('transactions').select('amount').eq('parent_transaction_id', parentTransactionId).eq('transaction_type', 'refund').eq('status', 'posted').is('deleted_at', null);
      if (refundsError) return fail('기존 환불 내역을 확인하지 못했어요.');
      const refunded = (refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);
      if (refunded + amount > Number(parent.amount)) return fail(`환불 가능 금액은 ${(Number(parent.amount) - refunded).toLocaleString('ko-KR')}원이에요.`);
    }
    let inheritedCategoryId = categoryId;
    let inheritedSubcategoryId = subcategoryId;
    let inheritedPaymentMethodId = paymentMethodId;
    let inheritedCostBehavior = categoryDefaultCostBehavior;
    if (transactionType === 'refund' && parentTransactionId) {
      const supabase = await createClient();
      const { data: parentFields } = await supabase.from('transactions').select('category_id, subcategory_id, payment_method_id, cost_behavior').eq('id', parentTransactionId).eq('household_id', householdId).is('deleted_at', null).single();
      if (parentFields) {
        inheritedCategoryId = parentFields.category_id;
        inheritedSubcategoryId = parentFields.subcategory_id;
        inheritedPaymentMethodId = parentFields.payment_method_id;
        inheritedCostBehavior = parentFields.cost_behavior;
      }
    }
    await createTransaction({
      householdId,
      transactionDate,
      transactionType,
      categoryId: inheritedCategoryId,
      categoryDefaultCostBehavior: inheritedCostBehavior,
      costBehaviorOverride,
      subcategoryId: inheritedSubcategoryId,
      paymentMethodId: inheritedPaymentMethodId,
      amount,
      description,
      parentTransactionId,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }

    revalidatePath('/monthly');
    revalidatePath('/dashboard');
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

export async function restoreTransactionAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('복구할 거래 id가 없습니다.');
  try { await getCurrentHouseholdId(); await restoreTransaction(id); }
  catch (error) { return fail(error instanceof Error ? error.message : '거래 복구에 실패했어요.'); }
  revalidatePath('/monthly'); revalidatePath('/dashboard'); revalidatePath('/settings/data');
  return ok('거래를 복구했어요.');
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
    revalidatePath('/dashboard');
  return ok();
}

export async function updateTransactionStatusAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const status = formData.get('status');
  if (!id) return fail('거래 id가 없습니다.');
  if (status !== 'planned' && status !== 'posted' && status !== 'skipped' && status !== 'cancelled') {
    return fail('올바른 거래 상태를 선택해주세요.');
  }

  try {
    await getCurrentHouseholdId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id');
    if (error) throw new Error(error.message);
    if (data.length !== 1) throw new Error('상태를 변경할 거래를 찾지 못했어요.');
  } catch (error) {
    return fail(error instanceof Error ? error.message : '거래 상태 변경에 실패했어요.');
  }

  revalidatePath('/monthly');
  revalidatePath('/dashboard');
  return ok('거래 상태를 변경했어요.');
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
  revalidatePath('/dashboard');
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

export async function reviewDuplicateTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const keeperId = String(formData.get('keeperId') ?? '');
  if (!id || !keeperId || id === keeperId) return fail('중복 후보와 유지할 원본을 확인해 주세요.');
  try {
    const householdId = await getCurrentHouseholdId();
    const supabase = await createClient();
    const { data, error } = await supabase.from('transactions')
      .select('id, household_id, transaction_date, transaction_type, amount, description, payment_method_id, created_at, deleted_at')
      .eq('household_id', householdId).in('id', [id, keeperId]).is('deleted_at', null);
    if (error) throw new Error(error.message);
    const keeper = data?.find((row) => row.id === keeperId);
    const candidate = data?.find((row) => row.id === id);
    if (!keeper || !candidate || duplicateTransactionKey({ householdId: keeper.household_id, transactionDate: keeper.transaction_date, transactionType: keeper.transaction_type, amount: keeper.amount, description: keeper.description, paymentMethodId: keeper.payment_method_id }) !== duplicateTransactionKey({ householdId: candidate.household_id, transactionDate: candidate.transaction_date, transactionType: candidate.transaction_type, amount: candidate.amount, description: candidate.description, paymentMethodId: candidate.payment_method_id })) return fail('현재 데이터가 중복 후보와 일치하지 않습니다. 목록을 새로고침해 주세요.');
    if (candidate.created_at < keeper.created_at) return fail('최초 원본보다 오래된 거래는 삭제할 수 없습니다.');
    const { error: updateError } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('household_id', householdId).is('deleted_at', null);
    if (updateError) throw new Error(updateError.message);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '중복 거래 처리에 실패했습니다.');
  }
  revalidatePath('/settings/data');
  revalidatePath('/monthly');
  revalidatePath('/dashboard');
  return ok('중복 거래를 삭제 처리했습니다.');
}
