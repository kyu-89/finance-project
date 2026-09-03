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
  memo: string | null;
  status: 'active' | 'closed';
};

export type ImportedAccount = Omit<Account, 'id' | 'status'>;

export async function listAccounts(householdId: string): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts')
    .select('id, bank_name, account_type, account_name, account_number, purpose, current_balance, memo, status')
    .eq('household_id', householdId)
    .order('status').order('created_at', { ascending: false });
  if (error) throw new Error(`계좌 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, bankName: row.bank_name, accountType: row.account_type as Account['accountType'],
    accountName: row.account_name, accountNumber: row.account_number, purpose: row.purpose,
    currentBalance: row.current_balance, memo: row.memo,
    status: row.status as Account['status'],
  }));
}

export async function createAccount(input: Omit<Account, 'id' | 'status'> & { householdId: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').insert({
    household_id: input.householdId, bank_name: input.bankName, account_type: input.accountType,
    account_name: input.accountName, account_number: input.accountNumber, purpose: input.purpose,
    current_balance: input.currentBalance, memo: input.memo,
  });
  if (error) throw new Error(`계좌 추가 실패: ${error.message}`);
}

// 이미 등록된 계좌의 은행명/계좌명/종류/현재 잔액/계좌번호/용도/메모를 한 번에 수정한다(§7,
// 사용자 지시: 신규 등록과 같은 필드·검증). id로만 대상을 찾아 UPDATE하므로 거래의
// transactions.account_id 참조는 그대로 유지된다 — 계좌를 새로 만들거나 지우지 않는다.
export async function updateAccount(input: {
  id: string;
  bankName: string;
  accountName: string;
  accountType: Account['accountType'];
  currentBalance: number;
  accountNumber: string | null;
  purpose: string | null;
  memo: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').update({
    bank_name: input.bankName,
    account_name: input.accountName,
    account_type: input.accountType,
    current_balance: input.currentBalance,
    account_number: input.accountNumber,
    purpose: input.purpose,
    memo: input.memo,
  }).eq('id', input.id).eq('status', 'active').select('id');
  if (error) throw new Error(`계좌 수정 실패: ${error.message}`);
  if (data.length !== 1) throw new Error('수정할 계좌를 찾지 못했어요.');
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

export async function importAccounts(input: { householdId: string; accounts: ImportedAccount[] }): Promise<number> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from('accounts').select('bank_name, account_type, account_name, account_number').eq('household_id', input.householdId);
  if (existingError) throw new Error(existingError.message);
  const key = (account: Pick<ImportedAccount, 'bankName' | 'accountType' | 'accountName' | 'accountNumber'>) => `${account.bankName.trim().toLocaleLowerCase()}|${account.accountType}|${account.accountName.trim().toLocaleLowerCase()}|${account.accountNumber ?? ''}`;
  const keys = new Set((existing ?? []).map((account) => key({ bankName: account.bank_name, accountType: account.account_type, accountName: account.account_name, accountNumber: account.account_number })));
  const rows = input.accounts.filter((account) => { const accountKey = key(account); if (keys.has(accountKey)) return false; keys.add(accountKey); return true; });
  if (rows.length === 0) return 0;
  const { error } = await supabase.from('accounts').insert(rows.map((account) => ({ household_id: input.householdId, bank_name: account.bankName, account_type: account.accountType, account_name: account.accountName, account_number: account.accountNumber, purpose: account.purpose, current_balance: account.currentBalance, memo: account.memo })));
  if (error) throw new Error(error.message);
  return rows.length;
}
