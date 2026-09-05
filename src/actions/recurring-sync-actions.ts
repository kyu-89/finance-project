'use server';

import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { promotePastPlannedTransactions } from '@/lib/transactions';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function syncRecurringTransactionsAction(input: {
  fromDate: string;
  toDate: string;
  currentMonthStart: string;
}) {
  if (!DATE_PATTERN.test(input.fromDate) || !DATE_PATTERN.test(input.toDate) || !DATE_PATTERN.test(input.currentMonthStart)) {
    throw new Error('반복 거래 동기화 날짜를 확인해 주세요.');
  }
  const household = await ensureHouseholdForCurrentUser();
  if (input.fromDate < input.currentMonthStart) {
    await materializeRecurringRulesForRange(household.id, input.fromDate, input.toDate);
    await promotePastPlannedTransactions(household.id, input.currentMonthStart);
  } else {
    await Promise.all([
      materializeRecurringRulesForRange(household.id, input.fromDate, input.toDate),
      promotePastPlannedTransactions(household.id, input.currentMonthStart),
    ]);
  }
  return { ok: true };
}
