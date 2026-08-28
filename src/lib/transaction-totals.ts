export type TotalableTransaction = {
  amount: number;
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
    }
    if (transaction.status === 'planned') {
      plannedTotal += transaction.amount;
    }
  }

  return { consumptionTotal, plannedTotal };
}
