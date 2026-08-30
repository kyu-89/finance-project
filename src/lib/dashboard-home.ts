import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type HomeMonth = { month: string; income: number; consumption: number; fixedConsumption: number; variableConsumption: number; saving: number; investment: number; debtPrincipal: number; financeCost: number };
export type HomeRank = { id: string; label: string; value: number };
export type HomeRecent = { id: string; transactionDate: string; transactionType: string; flowClass: string; amount: number; description: string };
export type DashboardHomeSummary = { monthly: HomeMonth[]; categories: HomeRank[]; payments: HomeRank[]; recent: HomeRecent[]; reviewCount: number; plannedCount: number; budgetTotal: number; budgetActual: number };

export async function getDashboardHomeSummary(input: { householdId: string; from: string; to: string; monthStart: string; monthEnd: string; memberId?: string }): Promise<DashboardHomeSummary> {
  const supabase = await createClient(); const unassigned = input.memberId === 'unassigned'; const { data, error } = await supabase.rpc('dashboard_home_summary', { p_household_id: input.householdId, p_from: input.from, p_to: input.to, p_month_start: input.monthStart, p_month_end: input.monthEnd, p_member_id: unassigned ? null : input.memberId ?? null, p_unassigned: unassigned }); if (error) throw new Error(`홈 요약 조회 실패: ${error.message}`); const value = data as Record<string, unknown>;
  const monthly = ((value.monthly ?? []) as Record<string, unknown>[]).map((r) => ({ month: String(r.month), income: Number(r.income), consumption: Number(r.consumption), fixedConsumption: Number(r.fixed_consumption), variableConsumption: Number(r.variable_consumption), saving: Number(r.saving), investment: Number(r.investment), debtPrincipal: Number(r.debt_principal), financeCost: Number(r.finance_cost) }));
  const ranks = (rows: unknown) => ((rows ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: String(r.label), value: Number(r.value) })); const recent = ((value.recent ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), transactionDate: String(r.transaction_date), transactionType: String(r.transaction_type), flowClass: String(r.flow_class), amount: Number(r.amount), description: String(r.description) }));
  return { monthly, categories: ranks(value.categories), payments: ranks(value.payments), recent, reviewCount: Number(value.reviewCount ?? 0), plannedCount: Number(value.plannedCount ?? 0), budgetTotal: Number(value.budgetTotal ?? 0), budgetActual: Number(value.budgetActual ?? 0) };
}
