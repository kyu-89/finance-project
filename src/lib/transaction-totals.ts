export type TotalableTransaction = {
  amount: number;
  transactionType?: string;
  flowClass: string;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled';
};

export function calculateTransactionTotals(transactions: TotalableTransaction[]): {
  consumptionTotal: number;
  plannedTotal: number;
} {
  let consumptionTotal = 0;
  let plannedTotal = 0;

  for (const transaction of transactions) {
    if (transaction.status === 'posted' && transaction.flowClass === 'consumption') {
      consumptionTotal += transaction.amount;
    } else if (transaction.status === 'posted' && transaction.transactionType === 'refund') {
      consumptionTotal -= transaction.amount;
    }
    // Only planned CONSUMPTION belongs beside the 소비 합계. Summing every planned row added
    // inflows and outflows together — a household with a 급여 rule (planned income) and a 월세
    // rule (planned expense) saw the two added into one meaningless figure.
    if (transaction.status === 'planned' && transaction.flowClass === 'consumption') {
      plannedTotal += transaction.amount;
    }
  }

  return { consumptionTotal, plannedTotal };
}
