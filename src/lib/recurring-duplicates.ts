export type DuplicateCandidateTransaction = {
  id: string;
  transactionDate: string;
  transactionType: 'income' | 'expense';
  flowClass?: string;
  amount: number;
  description: string;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled' | 'refunded';
  categoryId: string | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  recurringOccurrenceId: string | null;
};

export type DuplicateCandidate = {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
};

function dayDistance(left: string, right: string): number {
  return Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000;
}

function amountDistance(left: number, right: number): number {
  return Math.abs(left - right);
}

export function findRecurringDuplicateCandidates(
  transactions: DuplicateCandidateTransaction[],
): Record<string, DuplicateCandidate[]> {
  const posted = transactions.filter((transaction) => transaction.status === 'posted');
  return Object.fromEntries(transactions
    .filter((transaction) => transaction.status === 'planned' && transaction.recurringOccurrenceId)
    .map((planned) => {
      const candidates = posted
        .filter((candidate) => candidate.transactionType === planned.transactionType)
        .filter((candidate) => !planned.flowClass || !candidate.flowClass || candidate.flowClass === planned.flowClass)
        .filter((candidate) => amountDistance(candidate.amount, planned.amount) <= Math.max(1_000, Math.round(planned.amount * 0.05)))
        .map((candidate) => ({
          candidate,
          distance: dayDistance(planned.transactionDate, candidate.transactionDate),
          score:
            (planned.paymentMethodId && planned.paymentMethodId === candidate.paymentMethodId ? 2 : 0) +
            (planned.categoryId && planned.categoryId === candidate.categoryId ? 2 : 0) +
            (planned.subcategoryId && planned.subcategoryId === candidate.subcategoryId ? 1 : 0),
        }))
        .filter(({ distance }) => distance <= 3)
        .sort((a, b) => b.score - a.score || a.distance - b.distance)
        .slice(0, 3)
        .map(({ candidate }) => ({
          id: candidate.id,
          transactionDate: candidate.transactionDate,
          description: candidate.description,
          amount: candidate.amount,
        }));
      return [planned.id, candidates];
    }));
}
