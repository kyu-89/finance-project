import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type LoanPaymentSummary = { principal: number; interest: number; total: number; latestRemainingBalance: number | null };
export function summarizeLoanPayments(payments: LoanPayment[]): LoanPaymentSummary {
  const latest = [...payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.installment - a.installment)[0];
  return {
    principal: payments.reduce((sum, payment) => sum + payment.principalPayment, 0),
    interest: payments.reduce((sum, payment) => sum + payment.interestPayment, 0),
    total: payments.reduce((sum, payment) => sum + payment.totalPayment, 0),
    latestRemainingBalance: latest?.remainingBalance ?? null,
  };
}

export type LoanPayment = { id: string; loanId: string; installment: number; paymentDate: string; principalPayment: number; interestPayment: number; totalPayment: number; cumulativePayment: number; remainingBalance: number; paymentType: 'scheduled' | 'early' | 'refinance' | 'payoff'; memo: string | null };
export async function listLoanPayments(householdId: string): Promise<LoanPayment[]> { const supabase = await createClient(); const { data, error } = await supabase.from('loan_payments').select('id, loan_id, installment, payment_date, principal_payment, interest_payment, total_payment, cumulative_payment, remaining_balance, payment_type, memo').eq('household_id', householdId).order('payment_date', { ascending: false }); if (error) throw new Error(`대출 상환내역 조회 실패: ${error.message}`); return (data ?? []).map((row) => ({ id: row.id, loanId: row.loan_id, installment: row.installment, paymentDate: row.payment_date, principalPayment: row.principal_payment, interestPayment: row.interest_payment, totalPayment: row.total_payment, cumulativePayment: row.cumulative_payment, remainingBalance: row.remaining_balance, paymentType: row.payment_type, memo: row.memo })); }
export async function createLoanPayment(input: Omit<LoanPayment, 'id' | 'totalPayment'> & { householdId: string }): Promise<void> { const supabase = await createClient(); const { error } = await supabase.from('loan_payments').insert({ household_id: input.householdId, loan_id: input.loanId, installment: input.installment, payment_date: input.paymentDate, principal_payment: input.principalPayment, interest_payment: input.interestPayment, total_payment: input.principalPayment + input.interestPayment, cumulative_payment: input.cumulativePayment, remaining_balance: input.remainingBalance, payment_type: input.paymentType, memo: input.memo }); if (error) throw new Error(`대출 상환내역 추가 실패: ${error.message}`); }
