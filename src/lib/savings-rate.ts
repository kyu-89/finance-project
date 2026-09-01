export type SavingsRateMonth = { income: number; saving: number; investment: number };

export function calculateSavingsRate(months: SavingsRateMonth[]): number {
  const totalIncome = months.reduce((sum, month) => sum + Math.max(0, month.income), 0);
  if (totalIncome === 0) return 0;
  const totalSavings = months.reduce(
    (sum, month) => sum + Math.max(0, month.saving + month.investment),
    0,
  );
  return Math.min(1, Math.max(0, totalSavings / totalIncome));
}

export function formatSavingsRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
