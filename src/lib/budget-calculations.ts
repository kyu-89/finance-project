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
  let investment = 0;
  let debtPrincipal = 0;
  let financeCost = 0;
  const spentByCategory: Record<string, number> = {};

  for (const transaction of transactions) {
    if (transaction.status !== 'posted') continue;
    if (transaction.transactionType === 'income') income += transaction.amount;
    if (transaction.transactionType === 'saving') saving += transaction.amount;
    // PRD §1.4: 저축·투자·대출원금상환·금융비용 are each their own flow class. Keying these on
    // flow_class (not transaction_type) keeps them aligned with the one FLOW_CLASS_BY_TRANSACTION_TYPE
    // map, so a future transaction_type that maps to an existing class is counted automatically.
    if (transaction.flowClass === 'investment') investment += transaction.amount;
    if (transaction.flowClass === 'debt_principal') debtPrincipal += transaction.amount;
    if (transaction.flowClass === 'finance_cost') financeCost += transaction.amount;
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

  // PRD §1.4 / §36 — these are four DIFFERENT numbers and must not be collapsed into one
  // "월 차액". The previous single `balance = income - saving - consumption` silently dropped
  // 투자·대출원금·금융비용, so a household with a mortgage was shown far more spare cash than
  // it had, in the direction that encourages overspending.
  //
  //   생활수지   = 총수입 − 소비성지출 − 금융비용        (what living costs leave behind)
  //   자산형성액 = 저축 + 투자 + 대출원금상환             (cash that became net worth)
  //   현금잔여액 = 총현금유입 − 총현금유출                (what is actually left)
  //
  // 이체(transfer) is deliberately excluded from every one of these: it moves cash between the
  // household's own accounts and is neither income, cost, nor wealth creation (§23.5).
  const livingBalance = income - consumption - financeCost;
  const wealthBuilt = saving + investment + debtPrincipal;
  const cashOutflow = consumption + financeCost + saving + investment + debtPrincipal;
  const cashRemaining = income - cashOutflow;

  const savingsRate = income > 0 ? saving / income : null;
  const targetSavingsRate = plannedIncome > 0 ? savingBudget / plannedIncome : null;
  return {
    income,
    saving,
    consumption,
    investment,
    debtPrincipal,
    financeCost,
    budgetedConsumption,
    totalExpense: saving + consumption,
    // 현금 기준 잔여액. Kept under the existing `balance` key so no call site silently reads a
    // stale meaning; it now accounts for every outflow rather than three of them.
    balance: cashRemaining,
    cashRemaining,
    livingBalance,
    wealthBuilt,
    cashOutflow,
    wealthBuildingRate: income > 0 ? wealthBuilt / income : null,
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
