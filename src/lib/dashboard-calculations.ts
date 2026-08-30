import { calculateMonthlyClosing, type MonthlyBudget } from '@/lib/budget-calculations';
import type { Transaction } from '@/lib/transactions';

export type DashboardPreset = 'month' | 'last_month' | 'ytd' | 'last_year' | '3m' | '6m' | '12m' | 'custom';
export type DashboardRange = { from: string; to: string; previousFrom: string; previousTo: string; yearAgoFrom: string; yearAgoTo: string };

const DATE = /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/;
function utcDate(value: string) { return new Date(`${value}T00:00:00Z`); }
function formatDate(value: Date) { return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`; }
function validDate(value: string) { return DATE.test(value) && formatDate(utcDate(value)) === value; }
function addDays(value: string, days: number) { const date = utcDate(value); date.setUTCDate(date.getUTCDate() + days); return formatDate(date); }
function addMonths(value: string, months: number) { const source = utcDate(value); const day = source.getUTCDate(); const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1)); const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate(); target.setUTCDate(Math.min(day, last)); return formatDate(target); }
function monthStart(value: string) { return `${value.slice(0, 7)}-01`; }

export function resolveDashboardRange(anchorDate: string, preset: DashboardPreset, customFrom?: string, customTo?: string): DashboardRange {
  let from: string; let to: string;
  if (preset === 'custom' && customFrom && customTo && validDate(customFrom) && validDate(customTo) && customFrom <= customTo) { from = customFrom; to = customTo; }
  else if (preset === 'last_month') { to = addDays(monthStart(anchorDate), -1); from = monthStart(to); }
  else if (preset === 'ytd') { from = `${anchorDate.slice(0, 4)}-01-01`; to = anchorDate; }
  else if (preset === 'last_year') { from = `${Number(anchorDate.slice(0, 4)) - 1}-01-01`; to = `${Number(anchorDate.slice(0, 4)) - 1}-12-31`; }
  else if (preset === '3m' || preset === '6m' || preset === '12m') { const count = Number(preset.slice(0, -1)); from = monthStart(addMonths(anchorDate, -(count - 1))); to = anchorDate; }
  else { from = monthStart(anchorDate); to = anchorDate; }
  const days = Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000) + 1;
  return { from, to, previousFrom: addDays(from, -days), previousTo: addDays(from, -1), yearAgoFrom: addMonths(from, -12), yearAgoTo: addMonths(to, -12) };
}

export function compareMetric(current: number, previous: number): { amount: number; rate: number | null } {
  const amount = current - previous;
  return { amount, rate: previous === 0 ? null : amount / Math.abs(previous) };
}

export function buildDashboardPeriod(transactions: Transaction[], budgets: MonthlyBudget[]) {
  const closing = calculateMonthlyClosing(transactions, budgets);
  const spendingByPaymentMethod: Record<string, number> = {};
  for (const transaction of transactions) {
    if (transaction.status !== 'posted' || transaction.flowClass !== 'consumption' || !transaction.paymentMethodId) continue;
    spendingByPaymentMethod[transaction.paymentMethodId] = (spendingByPaymentMethod[transaction.paymentMethodId] ?? 0) + transaction.amount;
  }
  return { ...closing, spendingByPaymentMethod };
}

export const UNASSIGNED_DASHBOARD_MEMBER = 'unassigned';

// A transaction has two member relations with different meanings. For a household view,
// "who this money was for" is the more useful primary axis; the payer is the fallback when
// no beneficiary was recorded. Resolving to exactly one member keeps member totals additive
// even when payer and beneficiary are different people.
export function resolveDashboardMemberId(transaction: Transaction): string {
  return transaction.beneficiaryMemberId ?? transaction.payerMemberId ?? UNASSIGNED_DASHBOARD_MEMBER;
}

export function filterDashboardTransactionsByMember(
  transactions: Transaction[],
  memberId: string | undefined,
): Transaction[] {
  return memberId ? transactions.filter((transaction) => resolveDashboardMemberId(transaction) === memberId) : transactions;
}

export function buildDashboardMemberSpending(transactions: Transaction[]): Record<string, number> {
  const spending: Record<string, number> = {};
  for (const transaction of transactions) {
    if (transaction.status !== 'posted' || transaction.flowClass !== 'consumption') continue;
    const memberId = resolveDashboardMemberId(transaction);
    spending[memberId] = (spending[memberId] ?? 0) + transaction.amount;
  }
  return spending;
}

export function filterDashboardTransactions(transactions: Transaction[], drilldown: string | undefined): Transaction[] {
  if (!drilldown) return [];
  if (drilldown.startsWith('category:')) return transactions.filter((t) => t.status === 'posted' && t.categoryId === drilldown.slice(9));
  if (drilldown.startsWith('payment:')) return transactions.filter((t) => t.status === 'posted' && t.paymentMethodId === drilldown.slice(8) && t.flowClass === 'consumption');
  const predicate: Record<string, (t: Transaction) => boolean> = {
    income: (t) => t.transactionType === 'income', consumption: (t) => t.flowClass === 'consumption',
    saving: (t) => t.flowClass === 'saving', cash: (t) => !['transfer', 'adjustment'].includes(t.flowClass),
  };
  return transactions.filter((t) => t.status === 'posted' && (predicate[drilldown]?.(t) ?? false));
}
