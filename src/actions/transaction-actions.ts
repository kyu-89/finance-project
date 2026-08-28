'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createTransaction } from '@/lib/transactions';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
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

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('금액을 올바르게 입력해주세요.');
  }
  if (!description) {
    throw new Error('내용을 입력해주세요.');
  }

  await createTransaction({
    householdId: household.id,
    transactionDate: new Date().toISOString().slice(0, 10),
    transactionType,
    categoryId,
    categoryDefaultCostBehavior,
    subcategoryId,
    paymentMethodId,
    amount,
    description,
    memo,
  });

  redirect('/quick-add?saved=1');
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
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('금액을 올바르게 입력해주세요.');
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
