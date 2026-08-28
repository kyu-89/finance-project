import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { currentMonthRangeInSeoul } from '@/lib/date';
import { MonthlyPageTabs } from './MonthlyPageTabs';

export default async function MonthlyPage() {
  const household = await ensureHouseholdForCurrentUser();
  const { fromDate, toDate } = currentMonthRangeInSeoul();

  const [transactions, categories, paymentMethods] = await Promise.all([
    listTransactions({ householdId: household.id, fromDate, toDate }),
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
  ]);

  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.isActive);
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);

  return (
    <div className="tds-page">
      <h1 className="tds-title mb-2">이번 달 내역을 관리해요</h1>
      <p className="mb-6 text-sm text-[var(--tds-grey-700)]">
        {fromDate} ~ {toDate} · 예산·결산/반복항목/월말점검 탭은 Sprint 2-3에서 추가됩니다.
      </p>
      <MonthlyPageTabs
        transactions={transactions}
        categories={expenseCategories}
        paymentMethods={activePaymentMethods}
      />
    </div>
  );
}
