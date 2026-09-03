export type TotalableTransaction = {
  amount: number;
  transactionType?: string;
  flowClass: string;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled' | 'refunded';
};

// 2026-09: 환불/취소는 이제 별도 transaction_type이 아니라 그 거래 자체의 status
// ('refunded'/'cancelled')이므로, status==='posted' 조건에서 이미 자동으로 빠진다 —
// transactionType==='refund'를 따로 빼는 로직이 필요 없어졌다.
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
    // Only planned CONSUMPTION belongs beside the 소비 합계. Summing every planned row added
    // inflows and outflows together — a household with a 급여 rule (planned income) and a 월세
    // rule (planned expense) saw the two added into one meaningless figure.
    if (transaction.status === 'planned' && transaction.flowClass === 'consumption') {
      plannedTotal += transaction.amount;
    }
  }

  return { consumptionTotal, plannedTotal };
}
