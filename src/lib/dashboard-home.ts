import 'server-only';
import { createClient } from '@/lib/supabase/server';

// 2026-09: 거래 유형이 수입/지출로만 축소되면서 saving/investment/debtPrincipal/financeCost는
// RPC가 더 이상 만들어내지 않는다(항상 0이 되던 필드라 아예 없앴다 — 저축/대출 등은 이제 지출
// 카테고리로 구분되므로 flow_class 기반의 별도 버킷이 의미가 없어졌다).
export type HomeMonth = { month: string; income: number; consumption: number; fixedConsumption: number; variableConsumption: number };
export type HomeRank = { id: string; label: string; value: number; subcategories?: HomeRank[] };
export type HomeMonthlyCategory = { month: string; total: number; categories: HomeRank[] };
export type HomeRecent = { id: string; transactionDate: string; transactionType: string; flowClass: string; amount: number; description: string };
export type DashboardHomeSummary = { monthly: HomeMonth[]; monthlyCategories: HomeMonthlyCategory[]; categories: HomeRank[]; payments: HomeRank[]; recent: HomeRecent[]; reviewCount: number; plannedCount: number; budgetTotal: number; budgetActual: number };

export async function getDashboardHomeSummary(input: { householdId: string; from: string; to: string; monthStart: string; monthEnd: string }): Promise<DashboardHomeSummary> {
  const supabase = await createClient(); const { data, error } = await supabase.rpc('dashboard_home_summary', { p_household_id: input.householdId, p_from: input.from, p_to: input.to, p_month_start: input.monthStart, p_month_end: input.monthEnd }); if (error) throw new Error(`홈 요약 조회 실패: ${error.message}`); const value = data as Record<string, unknown>;
  const monthly = ((value.monthly ?? []) as Record<string, unknown>[]).map((r) => ({ month: String(r.month), income: Number(r.income), consumption: Number(r.consumption), fixedConsumption: Number(r.fixed_consumption), variableConsumption: Number(r.variable_consumption) }));
  const ranks = (rows: unknown): HomeRank[] => ((rows ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: String(r.label), value: Number(r.value), subcategories: r.subcategories ? ranks(r.subcategories) : undefined })); const recent = ((value.recent ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), transactionDate: String(r.transaction_date), transactionType: String(r.transaction_type), flowClass: String(r.flow_class), amount: Number(r.amount), description: String(r.description) }));
  const monthlyCategories = ((value.monthlyCategories ?? []) as Record<string, unknown>[]).map((r) => ({ month: String(r.month), total: Number(r.total), categories: ranks(r.categories) }));
  return { monthly, monthlyCategories, categories: ranks(value.categories), payments: ranks(value.payments), recent, reviewCount: Number(value.reviewCount ?? 0), plannedCount: Number(value.plannedCount ?? 0), budgetTotal: Number(value.budgetTotal ?? 0), budgetActual: Number(value.budgetActual ?? 0) };
}
