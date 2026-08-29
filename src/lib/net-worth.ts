export type NetWorthInput = {
  cashAssets: number; depositAssets: number; savingsAssets: number;
  investmentAssets: number; nonFinancialAssets: number; totalDebt: number;
};
export type NetWorthSummary = NetWorthInput & { financialAssets: number; totalAssets: number; netWorth: number; debtRatio: number | null };

export function calculateNetWorth(input: NetWorthInput): NetWorthSummary {
  const financialAssets = input.cashAssets + input.depositAssets + input.savingsAssets + input.investmentAssets;
  const totalAssets = financialAssets + input.nonFinancialAssets;
  const netWorth = totalAssets - input.totalDebt;
  return { ...input, financialAssets, totalAssets, netWorth, debtRatio: netWorth > 0 ? input.totalDebt / netWorth : null };
}

export function calculateNetWorthChange(current: number, previous: number): { amount: number; rate: number | null } {
  const amount = current - previous;
  return { amount, rate: previous === 0 ? null : amount / previous };
}
