export type BudgetStatus = 'safe' | 'caution' | 'near' | 'over';

export function budgetStatus(spent: number, budget: number): BudgetStatus {
  if (budget <= 0) return spent > 0 ? 'over' : 'safe';
  const ratio = spent / budget;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.9) return 'near';
  if (ratio >= 0.7) return 'caution';
  return 'safe';
}

export type ClosingTransaction = {
  amount: number;
  transactionType: string;
  flowClass: string;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled';
  includeInBudget: boolean;
  categoryId: string | null;
};

export type MonthlyBudget = { transactionType: 'income' | 'expense' | 'saving'; categoryId: string | null; amount: number };

export function calculateMonthlyClosing(transactions: ClosingTransaction[], budgets: MonthlyBudget[]) {
  let income = 0;
  let saving = 0;
  let consumption = 0;
  const spentByCategory: Record<string, number> = {};

  for (const transaction of transactions) {
    if (transaction.status !== 'posted') continue;
    if (transaction.transactionType === 'income') income += transaction.amount;
    if (transaction.transactionType === 'saving') saving += transaction.amount;
    if (transaction.flowClass === 'consumption') {
      consumption += transaction.amount;
      if (transaction.includeInBudget && transaction.categoryId) {
        spentByCategory[transaction.categoryId] = (spentByCategory[transaction.categoryId] ?? 0) + transaction.amount;
      }
    }
  }

  const budgetTotal = budgets.filter((budget) => budget.transactionType === 'expense').reduce((sum, budget) => sum + budget.amount, 0);
  const plannedIncome = budgets.filter((budget) => budget.transactionType === 'income').reduce((sum, budget) => sum + budget.amount, 0);
  const savingBudget = budgets.filter((budget) => budget.transactionType === 'saving').reduce((sum, budget) => sum + budget.amount, 0);
  const budgetedConsumption = Object.values(spentByCategory).reduce((sum, amount) => sum + amount, 0);
  const balance = income - saving - consumption;
  const savingsRate = income > 0 ? saving / income : null;
  const targetSavingsRate = plannedIncome > 0 ? savingBudget / plannedIncome : null;
  return {
    income,
    saving,
    consumption,
    budgetedConsumption,
    totalExpense: saving + consumption,
    balance,
    savingsRate,
    targetSavingsRate,
    savingsRateVariance: savingsRate !== null && targetSavingsRate !== null ? savingsRate - targetSavingsRate : null,
    consumptionRate: income > 0 ? consumption / income : null,
    budgetTotal,
    plannedIncome,
    savingBudget,
    incomeVariance: income - plannedIncome,
    savingVariance: saving - savingBudget,
    budgetRemaining: budgetTotal - budgetedConsumption,
    budgetUsageRate: budgetTotal > 0 ? budgetedConsumption / budgetTotal : null,
    spentByCategory,
  };
}
