import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { currentMonthRangeInSeoul } from '@/lib/date';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { findRecurringDuplicateCandidates } from '@/lib/recurring-duplicates';
import { listBudgets } from '@/lib/budgets';
import { MonthlyPageTabs } from './MonthlyPageTabs';

export default async function MonthlyPage() {
  const household = await ensureHouseholdForCurrentUser();
  const { fromDate, toDate } = currentMonthRangeInSeoul();
  await materializeRecurringRulesForRange(household.id, fromDate, toDate);

  const year = Number(fromDate.slice(0, 4));
  const month = Number(fromDate.slice(5, 7));
  const [transactions, categories, paymentMethods, annualBudgets] = await Promise.all([
    listTransactions({ householdId: household.id, fromDate, toDate }),
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listBudgets(household.id, year),
  ]);

  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.isActive);
  const budgetCategories = categories.filter((c) => c.transactionType === 'expense');
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);
  const duplicateCandidates = findRecurringDuplicateCandidates(transactions);
  const budgets = annualBudgets.filter((budget) => budget.month === month && budget.transactionType === 'expense');

  return (
    <div className="tds-page">
      <h1 className="tds-title mb-2">이번 달 내역을 관리해요</h1>
      <p className="mb-6 text-sm text-[var(--tds-grey-700)]">
        {fromDate} ~ {toDate} · 활성 반복항목은 예정 거래로 자동 채워져요.
      </p>
      <MonthlyPageTabs
        transactions={transactions}
        categories={expenseCategories}
        paymentMethods={activePaymentMethods}
        duplicateCandidates={duplicateCandidates}
        budgets={budgets}
        budgetCategories={budgetCategories}
      />
    </div>
  );
}
