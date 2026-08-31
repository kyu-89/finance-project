import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { HomeRank } from '@/lib/dashboard-home';

export async function getDashboardMonthlySubcategories(input: { householdId: string; from: string; to: string; memberId?: string }): Promise<Array<{ month: string; id: string; label: string; value: number; subcategories: HomeRank[] }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_monthly_subcategory_summary', { p_household_id: input.householdId, p_from: input.from, p_to: input.to, p_member_id: input.memberId && input.memberId !== 'unassigned' ? input.memberId : null, p_unassigned: input.memberId === 'unassigned' });
  if (error) throw new Error(`소분류 분석 조회 실패: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({ month: String(row.month), id: String(row.id), label: String(row.label), value: Number(row.value), subcategories: ((row.subcategories ?? []) as Record<string, unknown>[]).map((item) => ({ id: String(item.id), label: String(item.label), value: Number(item.value) })) }));
}
