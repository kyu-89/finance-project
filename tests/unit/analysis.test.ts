import { describe, expect, it } from 'vitest';
import {
  dailyCashflow,
  monthlyCashflow,
  periodTotals,
  reportMonthOf,
  summarizeCardUsage,
  summarizeExpenseByCategory,
  summarizeIncomeBySubcategory,
  summarizeReferenceByPaymentMethod,
} from '@/lib/analysis';
import type { Transaction } from '@/lib/transactions';
import type { PaymentMethod } from '@/lib/payment-methods';

const SAVINGS_CATEGORY_ID = 'cat-savings';
const FOOD_CATEGORY_ID = 'cat-food';

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    householdId: 'h1',
    transactionDate: '2026-03-15',
    sourceMonth: null,
    transactionType: 'expense',
    flowClass: 'consumption',
    costBehavior: null,
    paymentMethodId: null,
    categoryId: null,
    subcategoryId: null,
    amount: 10_000,
    description: '',
    memo: null,
    tags: [],
    includeInBudget: true,
    needsReview: false,
    recurringRuleId: null,
    recurringOccurrenceId: null,
    status: 'posted',
    ...overrides,
  };
}

describe('periodTotals', () => {
  it('sums income, expense (savings-type included, not double-counted), and net cashflow', () => {
    const rows = [
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 3_000_000 }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 500_000, categoryId: FOOD_CATEGORY_ID }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 300_000, categoryId: SAVINGS_CATEGORY_ID }),
    ];
    const totals = periodTotals(rows, SAVINGS_CATEGORY_ID);
    expect(totals.income).toBe(3_000_000);
    expect(totals.expense).toBe(800_000); // 500,000 + 300,000 — savings-type is part of total expense
    expect(totals.savings).toBe(300_000); // informational subset, not subtracted from expense
    expect(totals.net).toBe(3_000_000 - 800_000);
  });

  it('excludes reference transactions from income, expense, and net', () => {
    const rows = [
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 1_000_000 }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 200_000 }),
      tx({ transactionType: 'reference', flowClass: 'excluded', amount: 999_999_999 }),
    ];
    const totals = periodTotals(rows, null);
    expect(totals.income).toBe(1_000_000);
    expect(totals.expense).toBe(200_000);
    expect(totals.net).toBe(800_000);
    expect(totals.referenceCount).toBe(1);
    expect(totals.referenceTotal).toBe(999_999_999);
  });

  it('ignores planned/skipped/cancelled/refunded transactions — only posted counts', () => {
    const rows = [
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 500_000, status: 'planned' }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 100_000, status: 'cancelled' }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 50_000, status: 'refunded' }),
    ];
    expect(periodTotals(rows, null)).toMatchObject({ income: 0, expense: 0, net: 0 });
  });

  it('never lets savings exceed expense, and returns 0 savings without a savings category id', () => {
    const rows = [tx({ transactionType: 'expense', flowClass: 'consumption', amount: 100_000, categoryId: FOOD_CATEGORY_ID })];
    expect(periodTotals(rows, null).savings).toBe(0);
    expect(periodTotals(rows, SAVINGS_CATEGORY_ID).savings).toBe(0); // no row matches the savings category
  });
});

describe('summarizeIncomeBySubcategory', () => {
  it('groups by subcategory and never introduces a redundant top-level 수입 layer', () => {
    const names = new Map([['sub-salary', '급여'], ['sub-bonus', '상여']]);
    const rows = summarizeIncomeBySubcategory([
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 3_000_000, subcategoryId: 'sub-salary' }),
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 500_000, subcategoryId: 'sub-salary' }),
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 1_000_000, subcategoryId: 'sub-bonus' }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 999_999 }), // must not leak in
    ], names);
    expect(rows).toEqual([
      { id: 'sub-salary', label: '급여', value: 3_500_000, count: 2 },
      { id: 'sub-bonus', label: '상여', value: 1_000_000, count: 1 },
    ]);
  });
});

describe('summarizeExpenseByCategory', () => {
  it('nests subcategories under category, treating 저축성지출 as one ordinary category among others', () => {
    const categoryNames = new Map([[SAVINGS_CATEGORY_ID, '저축성지출'], [FOOD_CATEGORY_ID, '식비']]);
    const subcategoryNames = new Map([['sub-deposit', '예/적금'], ['sub-mart', '시장/마트']]);
    const rows = summarizeExpenseByCategory([
      tx({ categoryId: SAVINGS_CATEGORY_ID, subcategoryId: 'sub-deposit', amount: 300_000 }),
      tx({ categoryId: FOOD_CATEGORY_ID, subcategoryId: 'sub-mart', amount: 50_000 }),
      tx({ transactionType: 'reference', flowClass: 'excluded', categoryId: SAVINGS_CATEGORY_ID, amount: 777 }), // must not leak in
    ], categoryNames, subcategoryNames);
    expect(rows).toHaveLength(2);
    const savingsRow = rows.find((r) => r.id === SAVINGS_CATEGORY_ID)!;
    expect(savingsRow.value).toBe(300_000);
    expect(savingsRow.subcategories).toEqual([{ id: 'sub-deposit', label: '예/적금', value: 300_000, count: 1 }]);
  });
});

describe('summarizeReferenceByPaymentMethod', () => {
  it('only includes reference transactions, grouped by payment method', () => {
    const names = new Map([['pm-card', '신한신용']]);
    const rows = summarizeReferenceByPaymentMethod([
      tx({ transactionType: 'reference', flowClass: 'excluded', paymentMethodId: 'pm-card', amount: 100_000 }),
      tx({ transactionType: 'expense', flowClass: 'consumption', paymentMethodId: 'pm-card', amount: 999_999 }), // must not leak in
    ], names);
    expect(rows).toEqual([{ id: 'pm-card', label: '신한신용', value: 100_000, count: 1 }]);
  });
});

const paymentMethods: PaymentMethod[] = [
  { id: 'pm-credit', householdId: 'h1', name: '신한신용', methodType: 'credit_card', providerName: null, accountNumber: null, cardNumberLast4: null, expiresAt: null, isActive: true },
  { id: 'pm-check', householdId: 'h1', name: '하나체크', methodType: 'check_card', providerName: null, accountNumber: null, cardNumberLast4: null, expiresAt: null, isActive: true },
  { id: 'pm-cash', householdId: 'h1', name: '현금', methodType: 'cash', providerName: null, accountNumber: null, cardNumberLast4: null, expiresAt: null, isActive: true },
];

describe('summarizeCardUsage', () => {
  it('separates actual-expense card usage from reference card usage, and excludes income/cash/no-payment-method', () => {
    const usage = summarizeCardUsage([
      tx({ transactionType: 'expense', flowClass: 'consumption', paymentMethodId: 'pm-credit', amount: 100_000 }),
      tx({ transactionType: 'expense', flowClass: 'consumption', paymentMethodId: 'pm-credit', categoryId: SAVINGS_CATEGORY_ID, amount: 50_000 }), // savings-type via card counts as actual expense
      tx({ transactionType: 'reference', flowClass: 'excluded', paymentMethodId: 'pm-credit', amount: 30_000 }),
      tx({ transactionType: 'expense', flowClass: 'consumption', paymentMethodId: 'pm-check', amount: 20_000 }),
      tx({ transactionType: 'reference', flowClass: 'excluded', paymentMethodId: 'pm-cash', amount: 999_999 }), // cash reference excluded from card usage
      tx({ transactionType: 'reference', flowClass: 'excluded', paymentMethodId: null, amount: 999_999 }), // no payment method excluded
      tx({ transactionType: 'income', flowClass: 'cash_in', paymentMethodId: 'pm-credit', amount: 999_999 }), // income never counted
    ], paymentMethods);

    const credit = usage.cards.find((c) => c.id === 'pm-credit')!;
    expect(credit.expenseAmount).toBe(150_000);
    expect(credit.referenceAmount).toBe(30_000);
    expect(credit.totalAmount).toBe(180_000);

    expect(usage.totalExpense).toBe(170_000); // 150,000 (credit) + 20,000 (check)
    expect(usage.totalReference).toBe(30_000);
    expect(usage.total).toBe(200_000);
    expect(usage.creditTotal).toBe(180_000);
    expect(usage.checkTotal).toBe(20_000);
    // cash and no-payment-method reference rows must never appear as a card
    expect(usage.cards.some((c) => c.methodType === 'cash')).toBe(false);
  });
});

describe('reportMonthOf', () => {
  it('prefers source_month over the transaction_date month', () => {
    expect(reportMonthOf(tx({ transactionDate: '2026-01-05', sourceMonth: '2025-12' }))).toBe('2025-12');
  });

  it('falls back to the transaction_date month when source_month is null', () => {
    expect(reportMonthOf(tx({ transactionDate: '2026-03-20', sourceMonth: null }))).toBe('2026-03');
  });
});

describe('monthlyCashflow', () => {
  it('buckets rows by reportMonthOf (source_month-aware) across the requested months', () => {
    const rows = [
      tx({ transactionType: 'income', flowClass: 'cash_in', amount: 1_000_000, transactionDate: '2026-02-01', sourceMonth: '2026-01' }),
      tx({ transactionType: 'expense', flowClass: 'consumption', amount: 200_000, transactionDate: '2026-02-10' }),
    ];
    const points = monthlyCashflow(rows, ['2026-01', '2026-02'], null);
    expect(points).toEqual([
      { month: '2026-01', income: 1_000_000, expense: 0, savings: 0, net: 1_000_000 },
      { month: '2026-02', income: 0, expense: 200_000, savings: 0, net: -200_000 },
    ]);
  });
});

describe('dailyCashflow', () => {
  it('buckets rows by transaction_date across every day in the range, including empty days', () => {
    const rows = [tx({ transactionType: 'income', flowClass: 'cash_in', amount: 500_000, transactionDate: '2026-03-02' })];
    const days = dailyCashflow(rows, '2026-03-01', '2026-03-03', null);
    expect(days).toEqual([
      { date: '2026-03-01', income: 0, expense: 0, savings: 0 },
      { date: '2026-03-02', income: 500_000, expense: 0, savings: 0 },
      { date: '2026-03-03', income: 0, expense: 0, savings: 0 },
    ]);
  });
});
