'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createTransaction } from '@/lib/transactions';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import type { TransactionType } from '@/lib/cost-behavior';

export async function createQuickTransactionAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();

  const amount = Number(formData.get('amount'));
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const categoryDefaultCostBehavior = (formData.get('categoryDefaultCostBehavior') || null) as
    'fixed' | 'variable' | null;
  const subcategoryId = String(formData.get('subcategoryId') ?? '') || null;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  const description = String(formData.get('description') ?? '').trim();
  const memo = String(formData.get('memo') ?? '') || null;
  const transactionType = (formData.get('transactionType') as TransactionType) ?? 'expense';

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('금액은 1원 단위의 정수로 입력해주세요.');
  }
  if (!description) {
    throw new Error('내용을 입력해주세요.');
  }
  // PRD §5.1: 대분류→소분류→결제수단 are required entry steps. Without this, tapping 저장
  // before touching the pickers silently saves an uncategorized row (category_id/cost_behavior
  // both null), invisible to all category and 고정비/변동비 analysis. 소분류 stays optional —
  // some categories (e.g. 협찬) have only one meaningful choice.
  if (!categoryId) {
    throw new Error('대분류를 선택해주세요.');
  }
  if (!paymentMethodId) {
    throw new Error('결제수단을 선택해주세요.');
  }

  await createTransaction({
    householdId: household.id,
    transactionDate: todayInSeoul(),
    transactionType,
    categoryId,
    categoryDefaultCostBehavior,
    subcategoryId,
    paymentMethodId,
    amount,
    description,
    memo,
  });

  // A unique value per save (rather than a constant `1`) so consecutive saves each produce a
  // distinct URL — QuickAddForm keys its "saved" effect (confirmation banner + form reset) off
  // this value, and a same-segment navigation to an unchanged URL wouldn't re-trigger it.
  redirect(`/quick-add?saved=${Date.now()}`);
}

export async function createMonthlyRowAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();

  const amount = Number(formData.get('amount'));
  const transactionDate = String(formData.get('transactionDate') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const categoryDefaultCostBehavior = (formData.get('categoryDefaultCostBehavior') || null) as
    'fixed' | 'variable' | null;
  const subcategoryId = String(formData.get('subcategoryId') ?? '') || null;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  const transactionType = (formData.get('transactionType') as TransactionType) ?? 'expense';

  if (!transactionDate) {
    throw new Error('날짜를 입력해주세요.');
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('금액은 1원 단위의 정수로 입력해주세요.');
  }
  if (!description) {
    throw new Error('내용을 입력해주세요.');
  }

  await createTransaction({
    householdId: household.id,
    transactionDate,
    transactionType,
    categoryId,
    categoryDefaultCostBehavior,
    subcategoryId,
    paymentMethodId,
    amount,
    description,
  });

  revalidatePath('/monthly');
}
