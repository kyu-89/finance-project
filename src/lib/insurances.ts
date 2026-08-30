import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Insurance = { id: string; insurerName: string; insuranceType: string; productName: string; coverageSummary: string | null; insuredMemberId: string | null; paymentMethodId: string | null; paymentMethodNote: string | null; joinedAt: string; paymentMaturityDate: string | null; coverageMaturityDate: string | null; monthlyPremium: number; paymentDay: number | null; contact: string | null; memo: string | null; status: 'active' | 'terminated' | 'free' };

export async function listInsurances(householdId: string): Promise<Insurance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('insurances').select('id, insurer_name, insurance_type, product_name, coverage_summary, insured_member_id, payment_method_id, payment_method_note, joined_at, payment_maturity_date, coverage_maturity_date, monthly_premium, payment_day, contact, memo, status').eq('household_id', householdId).order('status').order('created_at', { ascending: false });
  if (error) throw new Error(`보험 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, insurerName: row.insurer_name, insuranceType: row.insurance_type, productName: row.product_name, coverageSummary: row.coverage_summary, insuredMemberId: row.insured_member_id, paymentMethodId: row.payment_method_id, paymentMethodNote: row.payment_method_note, joinedAt: row.joined_at, paymentMaturityDate: row.payment_maturity_date, coverageMaturityDate: row.coverage_maturity_date, monthlyPremium: row.monthly_premium, paymentDay: row.payment_day, contact: row.contact, memo: row.memo, status: row.status as Insurance['status'] }));
}

export async function createInsurance(input: Omit<Insurance, 'id' | 'status'> & { householdId: string }): Promise<void> {
  if (!input.insurerName.trim() || !input.insuranceType.trim() || !input.productName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.joinedAt) || !Number.isSafeInteger(input.monthlyPremium) || input.monthlyPremium < 0 || (input.paymentDay !== null && (!Number.isInteger(input.paymentDay) || input.paymentDay < 1 || input.paymentDay > 31))) throw new Error('보험 정보와 보험료를 확인해 주세요.');
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from('insurances').select('id').eq('household_id', input.householdId).eq('insurer_name', input.insurerName).eq('insurance_type', input.insuranceType).eq('product_name', input.productName).eq('joined_at', input.joinedAt).limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing?.length) return;
  const { error } = await supabase.from('insurances').insert({ household_id: input.householdId, insurer_name: input.insurerName, insurance_type: input.insuranceType, product_name: input.productName, coverage_summary: input.coverageSummary, insured_member_id: input.insuredMemberId, payment_method_id: input.paymentMethodId, payment_method_note: input.paymentMethodNote, joined_at: input.joinedAt, payment_maturity_date: input.paymentMaturityDate, coverage_maturity_date: input.coverageMaturityDate, monthly_premium: input.monthlyPremium, payment_day: input.paymentDay, contact: input.contact, memo: input.memo });
  if (error) throw new Error(`보험 추가 실패: ${error.message}`);
}

export async function endInsurance(id: string, status: 'terminated' | 'free', endedAt: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('insurances').update({ status, ended_at: endedAt }).eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`보험 상태 변경 실패: ${error.message}`);
}
