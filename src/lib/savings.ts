import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SavingsMethod } from '@/lib/savings-calculations';

export type SavingsAccount = {
  id: string; bankName: string; productName: string; joinedAt: string; maturityDate: string;
  monthlyAmount: number; annualRate: number; taxRate: number; interestMethod: SavingsMethod;
  currentSavings: number; monthlyPaymentDay: number | null; withdrawalAccountId: string | null;
  autoRecurring: boolean; memo: string | null;
  status: 'active' | 'matured' | 'terminated';
};

export async function listSavingsAccounts(householdId: string): Promise<SavingsAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('savings_accounts')
    .select('id, bank_name, product_name, joined_at, maturity_date, monthly_amount, annual_rate, tax_rate, interest_method, current_savings, monthly_payment_day, withdrawal_account_id, auto_recurring, memo, status')
    .eq('household_id', householdId).order('status').order('maturity_date');
  if (error) throw new Error(`적금 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, bankName: row.bank_name, productName: row.product_name, joinedAt: row.joined_at,
    maturityDate: row.maturity_date, monthlyAmount: row.monthly_amount, annualRate: Number(row.annual_rate),
    taxRate: Number(row.tax_rate), interestMethod: row.interest_method as SavingsMethod,
    currentSavings: row.current_savings, monthlyPaymentDay: row.monthly_payment_day,
    withdrawalAccountId: row.withdrawal_account_id, autoRecurring: row.auto_recurring,
    memo: row.memo, status: row.status as SavingsAccount['status'],
  }));
}

export async function createSavingsAccount(input: Omit<SavingsAccount, 'id' | 'status'> & { householdId: string }): Promise<void> {
  if (!input.bankName.trim() || !input.productName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.joinedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(input.maturityDate) || input.maturityDate < input.joinedAt || !Number.isSafeInteger(input.monthlyAmount) || input.monthlyAmount <= 0 || !Number.isSafeInteger(input.currentSavings) || input.currentSavings < 0 || !Number.isFinite(input.annualRate) || input.annualRate < 0) throw new Error('적금 정보와 금액·기간을 확인해 주세요.');
  const supabase = await createClient();
  const { error } = await supabase.from('savings_accounts').insert({
    household_id: input.householdId, bank_name: input.bankName, product_name: input.productName,
    joined_at: input.joinedAt, maturity_date: input.maturityDate, monthly_amount: input.monthlyAmount,
    annual_rate: input.annualRate, tax_rate: input.taxRate, interest_method: input.interestMethod,
    current_savings: input.currentSavings, monthly_payment_day: input.monthlyPaymentDay,
    withdrawal_account_id: input.withdrawalAccountId, auto_recurring: input.autoRecurring,
    memo: input.memo,
  });
  if (error) throw new Error(`적금 추가 실패: ${error.message}`);
}

export async function updateCurrentSavings(id: string, currentSavings: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('savings_accounts').update({ current_savings: currentSavings })
    .eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`적금 현재액 수정 실패: ${error.message}`);
}

export async function endSavingsAccount(id: string, status: 'matured' | 'terminated', endedAt: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('savings_accounts').update({ status, ended_at: endedAt, auto_recurring: false })
    .eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`적금 상태 변경 실패: ${error.message}`);
}
