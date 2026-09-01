export type DuplicateTransactionRecord = {
  id: string;
  householdId: string;
  transactionDate: string;
  transactionType: string;
  amount: number;
  description: string;
  paymentMethodId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  status: string;
  sourceMonth: string | null;
  createdAt: string;
};

export type DuplicateTransactionGroup = {
  key: string;
  keeper: DuplicateTransactionRecord;
  duplicates: DuplicateTransactionRecord[];
};

export function duplicateTransactionKey(row: Pick<DuplicateTransactionRecord, 'householdId' | 'transactionDate' | 'transactionType' | 'amount' | 'description' | 'paymentMethodId'>): string {
  return [row.householdId, row.transactionDate, row.transactionType, row.amount, row.description.trim().toLocaleLowerCase(), row.paymentMethodId ?? ''].join('|');
}

export function findDuplicateTransactionGroups(rows: DuplicateTransactionRecord[]): DuplicateTransactionGroup[] {
  const groups = new Map<string, DuplicateTransactionRecord[]>();
  rows.forEach((row) => {
    const key = duplicateTransactionKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return [...groups.entries()]
    .map(([key, group]) => [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)))
    .filter((group) => group.length > 1)
    .map((group) => ({ key: duplicateTransactionKey(group[0]), keeper: group[0], duplicates: group.slice(1) }));
}
