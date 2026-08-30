import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { LoanRepaymentMethod } from '@/lib/loan-calculations';

export type Loan = { id: string; institutionName: string; loanName: string; originalAmount: number; annualRate: number; repaymentMethod: LoanRepaymentMethod; loanDate: string; firstPaymentDate: string; maturityDate: string; graceMonths: number; ownerMemberId: string | null; memo: string | null; status: 'active' | 'paid_off' | 'refinanced' };

export async function listLoans(householdId: string): Promise<Loan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('loans').select('id, institution_name, loan_name, original_amount, annual_rate, repayment_method, loan_date, first_payment_date, maturity_date, grace_months, owner_member_id, memo, status').eq('household_id', householdId).order('status').order('maturity_date');
  if (error) throw new Error(`대출 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, institutionName: row.institution_name, loanName: row.loan_name, originalAmount: row.original_amount, annualRate: Number(row.annual_rate), repaymentMethod: row.repayment_method as LoanRepaymentMethod, loanDate: row.loan_date, firstPaymentDate: row.first_payment_date, maturityDate: row.maturity_date, graceMonths: row.grace_months, ownerMemberId: row.owner_member_id, memo: row.memo, status: row.status as Loan['status'] }));
}

export async function createLoan(input: Omit<Loan, 'id' | 'status'> & { householdId: string }): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('loans').insert({ household_id: input.householdId, institution_name: input.institutionName, loan_name: input.loanName, original_amount: input.originalAmount, annual_rate: input.annualRate, repayment_method: input.repaymentMethod, loan_date: input.loanDate, first_payment_date: input.firstPaymentDate, maturity_date: input.maturityDate, grace_months: input.graceMonths, owner_member_id: input.ownerMemberId, memo: input.memo }).select('id').single();
  if (error) throw new Error(`대출 추가 실패: ${error.message}`);
  return data.id;
}

export async function endLoan(id: string, status: 'paid_off' | 'refinanced', endedAt: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('loans').update({ status, ended_at: endedAt }).eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`대출 상태 변경 실패: ${error.message}`);
}
