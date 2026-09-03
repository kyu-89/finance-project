export type BudgetStatus = 'safe' | 'caution' | 'near' | 'over';

export function budgetStatus(spent: number, budget: number): BudgetStatus {
  if (budget <= 0) return spent > 0 ? 'over' : 'safe';
  const ratio = spent / budget;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.9) return 'near';
  if (ratio >= 0.7) return 'caution';
  return 'safe';
}

// 2026-09: 거래 유형이 수입/지출 두 가지로 축소되면서 flow_class도 cash_in/consumption 두 값만
// 남았다(저축/투자/대출원금상환/금융비용은 이제 별도 flow_class가 아니라 지출의 하위 카테고리다).
// 그래서 이 집계도 총수입/소비성지출/현금잔여액 세 값만 계산한다 — 예전의 생활수지·자산형성액·
// 저축률 등은 저축과 소비가 분리된 flow_class일 때만 의미가 있던 파생값이라 함께 걷어냈다.
export type ClosingTransaction = {
  amount: number;
  flowClass: string;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled' | 'refunded';
  includeInBudget: boolean;
  categoryId: string | null;
};

export type MonthlyBudget = { transactionType: 'income' | 'expense' | 'saving'; categoryId: string | null; amount: number };

export function calculateMonthlyClosing(transactions: ClosingTransaction[], budgets: MonthlyBudget[]) {
  let income = 0;
  let consumption = 0;
  const spentByCategory: Record<string, number> = {};

  for (const transaction of transactions) {
    if (transaction.status !== 'posted') continue;
    if (transaction.flowClass === 'cash_in') income += transaction.amount;
    if (transaction.flowClass === 'consumption') {
      consumption += transaction.amount;
      if (transaction.includeInBudget && transaction.categoryId) {
        spentByCategory[transaction.categoryId] = (spentByCategory[transaction.categoryId] ?? 0) + transaction.amount;
      }
    }
  }

  const budgetTotal = budgets.filter((budget) => budget.transactionType === 'expense').reduce((sum, budget) => sum + budget.amount, 0);
  const plannedIncome = budgets.filter((budget) => budget.transactionType === 'income').reduce((sum, budget) => sum + budget.amount, 0);
  const budgetedConsumption = Object.values(spentByCategory).reduce((sum, amount) => sum + amount, 0);
  const cashRemaining = income - consumption;

  return {
    income,
    consumption,
    budgetedConsumption,
    totalExpense: consumption,
    // 현금 기준 잔여액. Kept under the existing `balance` key so no call site silently reads a
    // stale meaning.
    balance: cashRemaining,
    cashRemaining,
    consumptionRate: income > 0 ? consumption / income : null,
    budgetTotal,
    plannedIncome,
    incomeVariance: income - plannedIncome,
    budgetRemaining: budgetTotal - budgetedConsumption,
    budgetUsageRate: budgetTotal > 0 ? budgetedConsumption / budgetTotal : null,
    spentByCategory,
  };
}
