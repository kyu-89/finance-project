import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { HomeMonthlyCategory, HomeRank } from '@/lib/dashboard-home';

export async function getDashboardIncomeSummary(input: { householdId: string; from: string; to: string; monthStart: string; monthEnd: string; memberId?: string; }): Promise<{ monthly: HomeMonthlyCategory[]; current: HomeRank[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_income_summary', { p_household_id: input.householdId, p_from: input.from, p_to: input.to, p_month_start: input.monthStart, p_month_end: input.monthEnd, p_member_id: input.memberId ?? null, p_unassigned: input.memberId === 'unassigned' });
  if (error) throw new Error(`수입 분석 조회 실패: ${error.message}`);
  const value = data as Record<string, unknown>;
  const ranks = (rows: unknown): HomeRank[] => ((rows ?? []) as Record<string, unknown>[]).map((row) => ({ id: String(row.id), label: String(row.label), value: Number(row.value), subcategories: row.subcategories ? ranks(row.subcategories) : undefined }));
  const current = ranks(value.current);
  const monthly = ((value.monthly ?? []) as Record<string, unknown>[]).map((row) => ({ month: String(row.month), total: Number(row.total), categories: ranks(row.categories) }));
  return { monthly: monthly.map((item) => item.month === input.monthStart.slice(0, 7) ? { ...item, categories: current } : item), current };
}
