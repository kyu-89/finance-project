import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type PaymentMethod = {
  id: string;
  householdId: string;
  name: string;
  methodType: 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';
  isActive: boolean;
  providerName: string | null;
  accountNumber: string | null;
  cardNumberLast4: string | null;
  expiresAt: string | null;
};

// PRD §4.3 — only 계좌이체/현금 are universal enough to seed by default; the user's actual
// cards are personal data they add themselves via CRUD, never hardcoded (§27).
export const DEFAULT_PAYMENT_METHOD_NAMES = ['계좌이체', '현금'];

export async function ensureDefaultPaymentMethodsSeeded(householdId: string): Promise<void> {
  const supabase = await createClient();

  // Per-row existence check (by name), same rationale as ensureDefaultCategoriesSeeded's fix:
  // a partial failure between the two inserts must not permanently strand the household missing
  // one of them.
  const { data: existing, error: existingError } = await supabase
    .from('payment_methods')
    .select('name')
    .eq('household_id', householdId);

  if (existingError) {
    throw new Error(`결제수단 시드 확인 실패: ${existingError.message}`);
  }

  const existingNames = new Set((existing ?? []).map((row) => row.name));
  const defaults = [
    { name: '계좌이체', method_type: 'account_transfer', display_order: 0 },
    { name: '현금', method_type: 'cash', display_order: 1 },
  ];
  const missing = defaults.filter((d) => !existingNames.has(d.name));
  if (missing.length === 0) {
    return;
  }

  const rows = missing.map((d) => ({
    household_id: householdId,
    name: d.name,
    method_type: d.method_type,
    display_order: d.display_order,
  }));

  const { error } = await supabase.from('payment_methods').insert(rows);
  if (error) {
    throw new Error(`결제수단 시드 실패: ${error.message}`);
  }
}

export async function listPaymentMethods(householdId: string): Promise<PaymentMethod[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, household_id, name, method_type, is_active, provider_name, account_number, card_number_last4, expires_at')
    .eq('household_id', householdId)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`결제수단 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    methodType: row.method_type,
    isActive: row.is_active, providerName: row.provider_name, accountNumber: row.account_number,
    cardNumberLast4: row.card_number_last4, expiresAt: row.expires_at,
  }));
}

export async function createPaymentMethod(input: {
  householdId: string;
  name: string;
  methodType: PaymentMethod['methodType'];
  providerName?: string | null; accountNumber?: string | null; cardNumberLast4?: string | null;
  expiresAt?: string | null;
}): Promise<PaymentMethod> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ household_id: input.householdId, name: input.name, method_type: input.methodType, provider_name: input.providerName ?? null, account_number: input.accountNumber ?? null, card_number_last4: input.cardNumberLast4 ?? null, expires_at: input.expiresAt ?? null })
    .select('id, household_id, name, method_type, is_active, provider_name, account_number, card_number_last4, expires_at')
    .single();

  if (error) {
    throw new Error(`결제수단 생성 실패: ${error.message}`);
  }

  return {
    id: data.id,
    householdId: data.household_id,
    name: data.name,
    methodType: data.method_type,
    isActive: data.is_active, providerName: data.provider_name, accountNumber: data.account_number,
    cardNumberLast4: data.card_number_last4, expiresAt: data.expires_at,
  };
}

export async function deactivatePaymentMethod(id: string, householdId?: string): Promise<void> {
  const supabase = await createClient();
  let query = supabase.from('payment_methods').update({ is_active: false }).eq('id', id);
  if (householdId) query = query.eq('household_id', householdId);
  const { error } = await query;
  if (error) {
    throw new Error(`결제수단 비활성화 실패: ${error.message}`);
  }
}

export async function setPaymentMethodActive(id: string, householdId: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_methods').update({ is_active: isActive }).eq('id', id).eq('household_id', householdId);
  if (error) throw new Error(`결제수단 상태 변경 실패: ${error.message}`);
}
