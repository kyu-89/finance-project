'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { copyPreviousYearBudgets, draftBudgetsFromPreviousActuals, saveAnnualBudgets, type Budget } from '@/lib/budgets';

export async function budgetEditorAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const year = Number(formData.get('year'));
  const intent = String(formData.get('intent') ?? 'save');
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return fail('예산 연도를 확인해 주세요.');

  try {
    const household = await ensureHouseholdForCurrentUser();
    if (intent === 'copy-previous') {
      await copyPreviousYearBudgets(household.id, year);
    } else if (intent === 'draft-actuals') {
      await draftBudgetsFromPreviousActuals(household.id, year);
    } else {
      const values: { transactionType: Budget['transactionType']; categoryId: string; month: number; amount: number }[] = [];
      for (const [key, rawValue] of formData.entries()) {
        if (!key.startsWith('budget:')) continue;
        const [, transactionType, categoryId, monthText] = key.split(':');
        const month = Number(monthText);
        const amount = Number(rawValue || 0);
        if (!['income', 'expense', 'saving'].includes(transactionType) || !categoryId || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isSafeInteger(amount) || amount < 0) {
          return fail('예산은 0 이상의 원 단위 정수로 입력해 주세요.');
        }
        values.push({ transactionType: transactionType as Budget['transactionType'], categoryId, month, amount });
      }
      await saveAnnualBudgets({ householdId: household.id, year, values });
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : '예산 처리에 실패했어요.');
  }

  revalidatePath('/settings/budgets');
  revalidatePath('/monthly');
  return ok();
}
