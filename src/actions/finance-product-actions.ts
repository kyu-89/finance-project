'use server';
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { todayInSeoul } from '@/lib/date';
import { getCurrentHouseholdId } from '@/lib/household';
import { createInsurance, endInsurance } from '@/lib/insurances';
import { buildAmortizationSchedule, paymentMonthsInclusive, type LoanRepaymentMethod } from '@/lib/loan-calculations';
import { createLoan, endLoan } from '@/lib/loans';

const optional = (form: FormData, key: string) => String(form.get(key) ?? '').trim() || null;
const date = (form: FormData, key: string) => { const value = String(form.get(key) ?? ''); return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; };
const won = (value: FormDataEntryValue | null) => { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null; };
const refresh = () => { revalidatePath('/finance'); revalidatePath('/finance/loans'); revalidatePath('/finance/insurances'); };

export async function createLoanAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const institutionName = String(form.get('institutionName') ?? '').trim(); const loanName = String(form.get('loanName') ?? '').trim();
  const originalAmount = won(form.get('originalAmount')); const annualRatePercent = Number(form.get('annualRate'));
  const repaymentMethod = String(form.get('repaymentMethod') ?? '') as LoanRepaymentMethod;
  const loanDate = date(form, 'loanDate'); const firstPaymentDate = date(form, 'firstPaymentDate'); const maturityDate = date(form, 'maturityDate');
  const graceMonths = Number(form.get('graceMonths') ?? 0);
  if (!institutionName || !loanName || !loanDate || !firstPaymentDate || !maturityDate || firstPaymentDate < loanDate || maturityDate < firstPaymentDate) return fail('대출 기본 정보와 날짜를 확인해 주세요.');
  if (originalAmount === null || originalAmount <= 0 || !Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > 100 || !Number.isInteger(graceMonths) || !['equal_payment', 'equal_principal', 'bullet'].includes(repaymentMethod)) return fail('대출금액·금리·상환방법을 확인해 주세요.');
  const termMonths = paymentMonthsInclusive(firstPaymentDate, maturityDate);
  try {
    buildAmortizationSchedule({ principal: originalAmount, annualRate: annualRatePercent / 100, termMonths, graceMonths, method: repaymentMethod, firstPaymentDate });
    await createLoan({ householdId: await getCurrentHouseholdId(), institutionName, loanName, originalAmount, annualRate: annualRatePercent / 100, repaymentMethod, loanDate, firstPaymentDate, maturityDate, graceMonths, ownerMemberId: optional(form, 'ownerMemberId'), memo: optional(form, 'memo') });
  } catch (error) { return fail(error instanceof Error ? error.message : '대출 추가에 실패했어요.'); }
  refresh(); return ok();
}

export async function endLoanAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const id = String(form.get('id') ?? ''); const status = String(form.get('status') ?? '') as 'paid_off' | 'refinanced';
  if (!id || !['paid_off', 'refinanced'].includes(status)) return fail('대출 상태를 확인해 주세요.');
  try { await endLoan(id, status, todayInSeoul()); } catch (error) { return fail(error instanceof Error ? error.message : '대출 상태 변경에 실패했어요.'); }
  refresh(); return ok();
}

export async function createInsuranceAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const insurerName = String(form.get('insurerName') ?? '').trim(); const insuranceType = String(form.get('insuranceType') ?? '').trim(); const productName = String(form.get('productName') ?? '').trim();
  const joinedAt = date(form, 'joinedAt'); const monthlyPremium = won(form.get('monthlyPremium')); const dayText = String(form.get('paymentDay') ?? ''); const paymentDay = dayText ? Number(dayText) : null;
  if (!insurerName || !insuranceType || !productName || !joinedAt || monthlyPremium === null) return fail('보험 기본 정보를 확인해 주세요.');
  if (paymentDay !== null && (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)) return fail('납부일은 1~31일로 입력해 주세요.');
  try { await createInsurance({ householdId: await getCurrentHouseholdId(), insurerName, insuranceType, productName, joinedAt, monthlyPremium, paymentDay, coverageSummary: optional(form, 'coverageSummary'), insuredMemberId: optional(form, 'insuredMemberId'), paymentMethodId: optional(form, 'paymentMethodId'), paymentMethodNote: optional(form, 'paymentMethodNote'), paymentMaturityDate: date(form, 'paymentMaturityDate'), coverageMaturityDate: date(form, 'coverageMaturityDate'), contact: optional(form, 'contact'), memo: optional(form, 'memo') }); }
  catch (error) { return fail(error instanceof Error ? error.message : '보험 추가에 실패했어요.'); }
  refresh(); return ok();
}

export async function endInsuranceAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const id = String(form.get('id') ?? ''); const status = String(form.get('status') ?? '') as 'terminated' | 'free';
  if (!id || !['terminated', 'free'].includes(status)) return fail('보험 상태를 확인해 주세요.');
  try { await endInsurance(id, status, todayInSeoul()); } catch (error) { return fail(error instanceof Error ? error.message : '보험 상태 변경에 실패했어요.'); }
  refresh(); return ok();
}
