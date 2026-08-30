'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentHouseholdId } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import { createTransaction } from '@/lib/transactions';
import { createRecurringRule, materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { upsertEventDetail, upsertSupportDetail } from '@/lib/transaction-details';
import { fail, ok, type ActionResult } from '@/lib/action-result';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const periodEnd = (value: string | null) => { const matches = [...(value ?? '').matchAll(/(20\d{2})[./-](\d{1,2})(?:[./-](\d{1,2}))?/g)]; const last = matches.at(-1); if (!last) return null; return `${last[1]}-${last[2].padStart(2, '0')}-${(last[3] ?? '01').padStart(2, '0')}`; };

export async function importSupportEventsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const supports = JSON.parse(String(form.get('supports') ?? '[]')) as Array<Record<string, unknown>>;
    const events = JSON.parse(String(form.get('events') ?? '[]')) as Array<Record<string, unknown>>;
    if (supports.length + events.length === 0 || supports.length + events.length > 2000) return fail('가져올 상세 데이터가 없습니다.');
    const householdId = await getCurrentHouseholdId(); let count = 0; let recurringCount = 0;
    for (const row of supports) {
      const amount = Number(row.amountPerOccurrence ?? row.totalExpectedAmount); if (!String(row.supportKind ?? '').trim() || !Number.isSafeInteger(amount) || amount <= 0) return fail('유효하지 않은 지원금 행이 포함되어 있습니다.');
      const expectedDate = String(row.expectedDate ?? ''); const startDate = datePattern.test(expectedDate) ? expectedDate : todayInSeoul(); const receivingPeriod = row.receivingPeriod ? String(row.receivingPeriod) : null; const endDate = periodEnd(receivingPeriod);
      const transaction = await createTransaction({ householdId, transactionDate: startDate, transactionType: 'income', categoryId: null, subcategoryId: null, paymentMethodId: null, amount, description: String(row.supportKind), memo: 'Excel 가져오기 · 원본 기간 보존', incomeGroup: 'additional', categoryDefaultCostBehavior: null, needsReview: true });
      await upsertSupportDetail(householdId, { transactionId: transaction.id, supportKind: String(row.supportKind), eligibility: row.eligibility ? String(row.eligibility) : null, applicationPeriod: row.applicationPeriod ? String(row.applicationPeriod) : null, receivingPeriod, payoutCycle: 'one_time', expectedDate: datePattern.test(expectedDate) ? expectedDate : null, amountPerOccurrence: Number(row.amountPerOccurrence) || null, totalExpectedAmount: Number(row.totalExpectedAmount) || amount, status: String(row.status ?? 'planned'), issuer: row.issuer ? String(row.issuer) : null, contact: null, sourceUrl: null, beneficiaryMemberId: null, memo: 'Excel 가져오기' });
      if (datePattern.test(expectedDate) && endDate && endDate > expectedDate && Number(row.amountPerOccurrence) > 0) { await createRecurringRule({ householdId, sourceType: 'support', startDate: expectedDate, endDate, frequency: 'monthly', intervalCount: 1, dayOfMonth: Number(expectedDate.slice(8, 10)), defaultAmount: Number(row.amountPerOccurrence), transactionType: 'income', costBehavior: null, categoryId: null, subcategoryId: null, paymentMethodId: null, description: String(row.supportKind) }); recurringCount += 1; }
      count += 1;
    }
    for (const row of events) { const amount = Number(row.amount); const date = String(row.eventDate ?? ''); if (!String(row.description ?? '').trim() || !Number.isSafeInteger(amount) || amount <= 0 || !datePattern.test(date)) return fail('유효하지 않은 경조사 행이 포함되어 있습니다.'); const transaction = await createTransaction({ householdId, transactionDate: date, transactionType: 'expense', categoryId: null, subcategoryId: null, paymentMethodId: null, amount, description: String(row.description), memo: 'Excel 가져오기', categoryDefaultCostBehavior: null, needsReview: true }); await upsertEventDetail(householdId, { transactionId: transaction.id, eventType: ['wedding', 'condolence', 'gift', 'other'].includes(String(row.eventType)) ? String(row.eventType) as 'wedding' | 'condolence' | 'gift' | 'other' : 'other', counterparty: null, relationshipGroup: null, eventDescription: String(row.description), relatedMemberId: null, memo: 'Excel 가져오기' }); count += 1; }
    if (recurringCount > 0) { const start = todayInSeoul(); const date = new Date(`${start}T00:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() + 1); const end = date.toISOString().slice(0, 10); await materializeRecurringRulesForRange(householdId, start, end); }
    revalidatePath('/monthly'); revalidatePath('/dashboard'); return ok(`${count}건을 가져왔습니다${recurringCount ? ` · 지원금 반복규칙 ${recurringCount}건 및 예정수입 생성` : ''}.`);
  } catch (error) { return fail(error instanceof Error ? error.message : '상세 데이터 가져오기에 실패했습니다.'); }
}
