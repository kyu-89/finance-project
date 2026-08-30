'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentHouseholdId } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import { createClient } from '@/lib/supabase/server';
import { createTransaction } from '@/lib/transactions';
import { createRecurringRule, materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { upsertEventDetail, upsertSupportDetail } from '@/lib/transaction-details';
import { fail, ok, type ActionResult } from '@/lib/action-result';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const periodEnd = (value: string | null) => { const matches = [...(value ?? '').matchAll(/(20\d{2})[./-](\d{1,2})(?:[./-](\d{1,2}))?/g)]; const last = matches.at(-1); return last ? `${last[1]}-${last[2].padStart(2, '0')}-${(last[3] ?? '01').padStart(2, '0')}` : null; };
const transactionKey = (date: string, type: string, amount: number, description: string) => `${date}|${type}|${amount}|${description.trim().toLocaleLowerCase()}`;

export async function importSupportEventsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const supports = JSON.parse(String(form.get('supports') ?? '[]')) as Array<Record<string, unknown>>;
    const events = JSON.parse(String(form.get('events') ?? '[]')) as Array<Record<string, unknown>>;
    if (!Array.isArray(supports) || !Array.isArray(events) || supports.length + events.length === 0 || supports.length + events.length > 2000) return fail('가져올 상세 데이터가 없거나 너무 많아요.');
    const householdId = await getCurrentHouseholdId();
    const supportDates = supports.map((row) => datePattern.test(String(row.expectedDate ?? '')) ? String(row.expectedDate) : todayInSeoul());
    const eventDates = events.map((row) => String(row.eventDate ?? '')).filter((date) => datePattern.test(date));
    const dates = [...supportDates, ...eventDates].sort();
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase.from('transactions').select('transaction_date,transaction_type,amount,description').eq('household_id', householdId).is('deleted_at', null).gte('transaction_date', dates[0]).lte('transaction_date', dates.at(-1));
    if (existingError) throw new Error(`기존 상세 거래 확인에 실패했어요: ${existingError.message}`);
    const keys = new Set((existing ?? []).map((row) => transactionKey(row.transaction_date, row.transaction_type, Number(row.amount), row.description)));
    let count = 0; let duplicateCount = 0; let recurringCount = 0;
    for (const row of supports) {
      const amount = Number(row.amountPerOccurrence ?? row.totalExpectedAmount); const supportKind = String(row.supportKind ?? '').trim();
      if (!supportKind || !Number.isSafeInteger(amount) || amount <= 0) return fail('유효하지 않은 지원금 행이 포함되어 있어요.');
      const expectedDate = String(row.expectedDate ?? ''); const startDate = datePattern.test(expectedDate) ? expectedDate : todayInSeoul(); const key = transactionKey(startDate, 'income', amount, supportKind);
      if (keys.has(key)) { duplicateCount += 1; continue; }
      const receivingPeriod = row.receivingPeriod ? String(row.receivingPeriod) : null; const endDate = periodEnd(receivingPeriod);
      const transaction = await createTransaction({ householdId, transactionDate: startDate, transactionType: 'income', categoryId: null, subcategoryId: null, paymentMethodId: null, amount, description: supportKind, memo: 'Excel 가져오기 · 원본 기간 보존', incomeGroup: 'additional', categoryDefaultCostBehavior: null, needsReview: true });
      await upsertSupportDetail(householdId, { transactionId: transaction.id, supportKind, eligibility: row.eligibility ? String(row.eligibility) : null, applicationPeriod: row.applicationPeriod ? String(row.applicationPeriod) : null, receivingPeriod, payoutCycle: 'one_time', expectedDate: datePattern.test(expectedDate) ? expectedDate : null, amountPerOccurrence: Number(row.amountPerOccurrence) || null, totalExpectedAmount: Number(row.totalExpectedAmount) || amount, status: String(row.status ?? 'planned'), issuer: row.issuer ? String(row.issuer) : null, contact: null, sourceUrl: null, beneficiaryMemberId: null, memo: 'Excel 가져오기' });
      keys.add(key); count += 1;
      if (datePattern.test(expectedDate) && endDate && endDate > expectedDate && Number(row.amountPerOccurrence) > 0) { await createRecurringRule({ householdId, sourceType: 'support', startDate: expectedDate, endDate, frequency: 'monthly', intervalCount: 1, dayOfMonth: Number(expectedDate.slice(8, 10)), defaultAmount: Number(row.amountPerOccurrence), transactionType: 'income', costBehavior: null, categoryId: null, subcategoryId: null, paymentMethodId: null, description: supportKind }); recurringCount += 1; }
    }
    for (const row of events) {
      const amount = Number(row.amount); const date = String(row.eventDate ?? ''); const description = String(row.description ?? '').trim();
      if (!description || !Number.isSafeInteger(amount) || amount <= 0 || !datePattern.test(date)) return fail('유효하지 않은 경조사 행이 포함되어 있어요.');
      const key = transactionKey(date, 'expense', amount, description);
      if (keys.has(key)) { duplicateCount += 1; continue; }
      const transaction = await createTransaction({ householdId, transactionDate: date, transactionType: 'expense', categoryId: null, subcategoryId: null, paymentMethodId: null, amount, description, memo: 'Excel 가져오기', categoryDefaultCostBehavior: null, needsReview: true });
      await upsertEventDetail(householdId, { transactionId: transaction.id, eventType: ['wedding', 'condolence', 'gift', 'other'].includes(String(row.eventType)) ? String(row.eventType) as 'wedding' | 'condolence' | 'gift' | 'other' : 'other', counterparty: null, relationshipGroup: null, eventDescription: description, relatedMemberId: null, memo: 'Excel 가져오기' });
      keys.add(key); count += 1;
    }
    if (recurringCount > 0) { const start = todayInSeoul(); const date = new Date(`${start}T00:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() + 1); await materializeRecurringRulesForRange(householdId, start, date.toISOString().slice(0, 10)); }
    revalidatePath('/monthly'); revalidatePath('/dashboard');
    return ok(`${count}건을 가져왔어요${duplicateCount ? ` · 중복 ${duplicateCount}건은 건너뛰었어요` : ''}${recurringCount ? ` · 지원금 예정수입 ${recurringCount}건을 생성했어요` : ''}.`);
  } catch (error) { return fail(error instanceof Error ? error.message : '상세 데이터 가져오기에 실패했어요.'); }
}
