import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type PaymentMethod = {
  id: string;
  householdId: string;
  name: string;
  methodType: 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';
  isActive: boolean;
};

// PRD §4.3 — only 계좌이체/현금 are universal enough to seed by default; the user's actual
// cards are personal data they add themselves via CRUD, never hardcoded (§27).
export const DEFAULT_PAYMENT_METHOD_NAMES = ['계좌이체', '현금'];

export async function ensureDefaultPaymentMethodsSeeded(householdId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from('payment_methods')
    .select('id')
    .eq('household_id', householdId)
    .limit(1);

  if (existingError) {
    throw new Error(`결제수단 시드 확인 실패: ${existingError.message}`);
  }
  if (existing && existing.length > 0) {
    return;
  }

  const rows = [
    { household_id: householdId, name: '계좌이체', method_type: 'account_transfer', display_order: 0 },
    { household_id: householdId, name: '현금', method_type: 'cash', display_order: 1 },
  ];

  const { error } = await supabase.from('payment_methods').insert(rows);
  if (error) {
    throw new Error(`결제수단 시드 실패: ${error.message}`);
  }
}

export async function listPaymentMethods(householdId: string): Promise<PaymentMethod[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, household_id, name, method_type, is_active')
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
    isActive: row.is_active,
  }));
}

export async function createPaymentMethod(input: {
  householdId: string;
  name: string;
  methodType: PaymentMethod['methodType'];
}): Promise<PaymentMethod> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ household_id: input.householdId, name: input.name, method_type: input.methodType })
    .select('id, household_id, name, method_type, is_active')
    .single();

  if (error) {
    throw new Error(`결제수단 생성 실패: ${error.message}`);
  }

  return {
    id: data.id,
    householdId: data.household_id,
    name: data.name,
    methodType: data.method_type,
    isActive: data.is_active,
  };
}

export async function deactivatePaymentMethod(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_methods').update({ is_active: false }).eq('id', id);
  if (error) {
    throw new Error(`결제수단 비활성화 실패: ${error.message}`);
  }
}
