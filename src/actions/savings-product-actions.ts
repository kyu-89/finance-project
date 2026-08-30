'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { todayInSeoul } from '@/lib/date';
import { createDeposit, endDeposit } from '@/lib/deposits';
import { getCurrentHouseholdId } from '@/lib/household';
import { createSavingsAccount, endSavingsAccount, updateCurrentSavings } from '@/lib/savings';
import type { SavingsMethod } from '@/lib/savings-calculations';

const optional = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim() || null;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function won(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function rate(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed / 100 : null;
}

function dates(formData: FormData): { joinedAt: string; maturityDate: string } | null {
  const joinedAt = String(formData.get('joinedAt') ?? '');
  const maturityDate = String(formData.get('maturityDate') ?? '');
  return ISO_DATE.test(joinedAt) && ISO_DATE.test(maturityDate) && maturityDate >= joinedAt
    ? { joinedAt, maturityDate }
    : null;
}

function refresh(): void {
  revalidatePath('/finance');
  revalidatePath('/finance/savings');
  revalidatePath('/monthly');
  revalidatePath('/monthly/month-end');
  revalidatePath('/dashboard');
}

export async function createDepositAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const bankName = String(formData.get('bankName') ?? '').trim();
  const productName = String(formData.get('productName') ?? '').trim();
  const period = dates(formData);
  const principal = won(formData.get('principal'));
  const annualRate = rate(formData.get('annualRate'));
  const taxRate = rate(formData.get('taxRate'));
  if (!bankName || !productName || !period) return fail('예금 상품명과 기간을 확인해 주세요.');
  if (principal === null || principal <= 0 || annualRate === null || taxRate === null) return fail('원금과 금리, 과세율을 확인해 주세요.');
  try {
    await createDeposit({
      householdId: await getCurrentHouseholdId(), bankName, productName, ...period, principal, annualRate, taxRate,
      ownerMemberId: optional(formData, 'ownerMemberId'), withdrawalAccountId: optional(formData, 'withdrawalAccountId'),
      memo: optional(formData, 'memo'),
    });
  } catch (error) { return fail(error instanceof Error ? error.message : '예금 추가에 실패했어요.'); }
  refresh();
  return ok();
}

export async function createSavingsAccountAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const bankName = String(formData.get('bankName') ?? '').trim();
  const productName = String(formData.get('productName') ?? '').trim();
  const period = dates(formData);
  const monthlyAmount = won(formData.get('monthlyAmount'));
  const currentSavings = won(formData.get('currentSavings'));
  const annualRate = rate(formData.get('annualRate'));
  const taxRate = rate(formData.get('taxRate'));
  const interestMethod = String(formData.get('interestMethod') ?? '') as SavingsMethod;
  const paymentDayValue = String(formData.get('monthlyPaymentDay') ?? '');
  const monthlyPaymentDay = paymentDayValue ? Number(paymentDayValue) : null;
  const autoRecurring = formData.get('autoRecurring') === 'on';
  if (!bankName || !productName || !period || !['simple', 'monthly_compound'].includes(interestMethod)) return fail('적금 상품명과 기간, 이자 방식을 확인해 주세요.');
  if (monthlyAmount === null || monthlyAmount <= 0 || currentSavings === null || annualRate === null || taxRate === null) return fail('월 적립액과 금리, 과세율을 확인해 주세요.');
  if (monthlyPaymentDay !== null && (!Number.isInteger(monthlyPaymentDay) || monthlyPaymentDay < 1 || monthlyPaymentDay > 31)) return fail('월 납부일은 1~31일로 입력해 주세요.');
  if (autoRecurring && monthlyPaymentDay === null) return fail('반복납입을 켜려면 월 납부일이 필요해요.');
  try {
    await createSavingsAccount({
      householdId: await getCurrentHouseholdId(), bankName, productName, ...period, monthlyAmount,
      currentSavings, annualRate, taxRate, interestMethod, monthlyPaymentDay, autoRecurring,
      ownerMemberId: optional(formData, 'ownerMemberId'), withdrawalAccountId: optional(formData, 'withdrawalAccountId'),
      memo: optional(formData, 'memo'),
    });
  } catch (error) { return fail(error instanceof Error ? error.message : '적금 추가에 실패했어요.'); }
  refresh();
  return ok();
}

export async function updateCurrentSavingsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const amount = won(formData.get('amount'));
  if (!id || amount === null) return fail('현재액을 0 이상의 원 단위 정수로 입력해 주세요.');
  try { await updateCurrentSavings(id, amount); }
  catch (error) { return fail(error instanceof Error ? error.message : '적금 현재액 수정에 실패했어요.'); }
  refresh();
  return ok();
}

export async function endDepositAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as 'matured' | 'terminated';
  if (!id || !['matured', 'terminated'].includes(status)) return fail('예금 상태를 확인해 주세요.');
  try { await endDeposit(id, status, todayInSeoul()); }
  catch (error) { return fail(error instanceof Error ? error.message : '예금 상태 변경에 실패했어요.'); }
  refresh(); return ok();
}

export async function endSavingsAccountAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as 'matured' | 'terminated';
  if (!id || !['matured', 'terminated'].includes(status)) return fail('적금 상태를 확인해 주세요.');
  try { await endSavingsAccount(id, status, todayInSeoul()); }
  catch (error) { return fail(error instanceof Error ? error.message : '적금 상태 변경에 실패했어요.'); }
  refresh(); return ok();
}
