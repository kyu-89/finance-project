import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Deposit = {
  id: string; bankName: string; productName: string; joinedAt: string; maturityDate: string;
  principal: number; annualRate: number; taxRate: number;
  withdrawalAccountId: string | null; memo: string | null; status: 'active' | 'matured' | 'terminated';
};

export async function listDeposits(householdId: string): Promise<Deposit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('deposits')
    .select('id, bank_name, product_name, joined_at, maturity_date, principal, annual_rate, tax_rate, withdrawal_account_id, memo, status')
    .eq('household_id', householdId).order('status').order('maturity_date');
  if (error) throw new Error(`예금 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, bankName: row.bank_name, productName: row.product_name, joinedAt: row.joined_at,
    maturityDate: row.maturity_date, principal: row.principal, annualRate: Number(row.annual_rate),
    taxRate: Number(row.tax_rate),
    withdrawalAccountId: row.withdrawal_account_id, memo: row.memo, status: row.status as Deposit['status'],
  }));
}

export async function createDeposit(input: Omit<Deposit, 'id' | 'status'> & { householdId: string }): Promise<void> {
  if (!input.bankName.trim() || !input.productName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.joinedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(input.maturityDate) || input.maturityDate < input.joinedAt || !Number.isSafeInteger(input.principal) || input.principal <= 0 || !Number.isFinite(input.annualRate) || input.annualRate < 0) throw new Error('예금 정보와 금액·기간을 확인해 주세요.');
  const supabase = await createClient();
  const { error } = await supabase.from('deposits').insert({
    household_id: input.householdId, bank_name: input.bankName, product_name: input.productName,
    joined_at: input.joinedAt, maturity_date: input.maturityDate, principal: input.principal,
    annual_rate: input.annualRate, tax_rate: input.taxRate,
    withdrawal_account_id: input.withdrawalAccountId, memo: input.memo,
  });
  if (error) throw new Error(`예금 추가 실패: ${error.message}`);
}

export async function endDeposit(id: string, status: 'matured' | 'terminated', endedAt: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('deposits').update({ status, ended_at: endedAt })
    .eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`예금 상태 변경 실패: ${error.message}`);
}
