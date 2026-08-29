import { calculateMonthlyClosing, type MonthlyBudget } from '@/lib/budget-calculations';
import type { Transaction } from '@/lib/transactions';

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
