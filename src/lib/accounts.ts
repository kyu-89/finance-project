import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Account = {
  id: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'cma' | 'other';
  accountName: string;
  accountNumber: string | null;
  purpose: string | null;
  currentBalance: number;
  ownerMemberId: string | null;
  memo: string | null;
  status: 'active' | 'closed';
};

export async function listAccounts(householdId: string): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts')
    .select('id, bank_name, account_type, account_name, account_number, purpose, current_balance, owner_member_id, memo, status')
    .eq('household_id', householdId)
    .order('status').order('created_at', { ascending: false });
  if (error) throw new Error(`계좌 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, bankName: row.bank_name, accountType: row.account_type as Account['accountType'],
    accountName: row.account_name, accountNumber: row.account_number, purpose: row.purpose,
    currentBalance: row.current_balance, ownerMemberId: row.owner_member_id, memo: row.memo,
    status: row.status as Account['status'],
  }));
}

export async function createAccount(input: Omit<Account, 'id' | 'status'> & { householdId: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').insert({
    household_id: input.householdId, bank_name: input.bankName, account_type: input.accountType,
    account_name: input.accountName, account_number: input.accountNumber, purpose: input.purpose,
    current_balance: input.currentBalance, owner_member_id: input.ownerMemberId, memo: input.memo,
  });
  if (error) throw new Error(`계좌 추가 실패: ${error.message}`);
}

export async function updateAccountBalance(id: string, amount: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').update({ current_balance: amount }).eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`계좌 잔액 수정 실패: ${error.message}`);
}

export async function closeAccount(id: string, closedAt: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').update({ status: 'closed', closed_at: closedAt }).eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`계좌 해지 실패: ${error.message}`);
}
