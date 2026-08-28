export type CostBehavior = 'fixed' | 'variable' | null;
export type TransactionType =
  | 'income' | 'expense' | 'saving' | 'investment' | 'debt_principal'
  | 'finance_cost' | 'transfer' | 'asset_adjustment' | 'refund';

// PRD §4.1 "비용 성격(cost behavior)": only expense (and, per §4.1's own text, finance_cost —
// deferred to whichever sprint implements loan interest transactions) carries fixed/variable.
// Sprint 1 only creates 'expense' transactions through the UI, so this function's practical
// input is always 'expense', but it's written to be correct for every transaction_type up front
// per PRD §35 ("적금/투자이체/대출원금 등 자산·부채 이동은 고정비/변동비 소비 분석에서 제외").
export function resolveCostBehavior(
  transactionType: TransactionType,
  categoryDefaultCostBehavior: CostBehavior,
  override: CostBehavior,
): CostBehavior {
  if (transactionType !== 'expense') {
    return null;
  }
  return override ?? categoryDefaultCostBehavior;
}
