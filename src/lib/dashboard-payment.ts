import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { HomeMonthlyCategory } from '@/lib/dashboard-home';

export async function getDashboardPaymentSummary(input: { householdId: string; from: string; to: string; memberId?: string }): Promise<HomeMonthlyCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_payment_summary', { p_household_id: input.householdId, p_from: input.from, p_to: input.to, p_member_id: input.memberId && input.memberId !== 'unassigned' ? input.memberId : null, p_unassigned: input.memberId === 'unassigned' });
  if (error) throw new Error(`결제수단 분석 조회 실패: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({ month: String(row.month), total: Number(row.total), categories: ((row.categories ?? []) as Record<string, unknown>[]).map((item) => ({ id: String(item.id), label: String(item.label), value: Number(item.value) })) }));
}
