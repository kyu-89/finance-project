import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions, promotePastPlannedTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { listBudgets } from '@/lib/budgets';
import { MonthlyPageTabs } from './MonthlyPageTabs';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, offset: number) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  return `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;
}

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ month?: string; category?: string; subcategory?: string; recurringRule?: string }> }) {
  const household = await ensureHouseholdForCurrentUser();
  const currentMonth = todayInSeoul().slice(0, 7);
  const params = await searchParams;
  const selectedMonth = params.month && MONTH_PATTERN.test(params.month) ? params.month : currentMonth;
  const selectedCategory = params.category && /^[0-9a-f-]{36}$/i.test(params.category) ? params.category : undefined;
  const selectedSubcategory = params.subcategory && /^[0-9a-f-]{36}$/i.test(params.subcategory) ? params.subcategory : undefined;
  const selectedRecurringRule = params.recurringRule && /^[0-9a-f-]{36}$/i.test(params.recurringRule) ? params.recurringRule : undefined;
  const { fromDate, toDate } = monthRangeFromSeoulDateString(`${selectedMonth}-01`);
  const year = Number(fromDate.slice(0, 4));
  const monthNumber = Number(fromDate.slice(5, 7));
  const metadataPromise = Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listBudgets(household.id, year),
  ]);
  await promotePastPlannedTransactions(household.id, `${currentMonth}-01`);
  await materializeRecurringRulesForRange(household.id, fromDate, toDate);

  const [[categories, paymentMethods, annualBudgets], [transactions, allTransactions]] = await Promise.all([
    metadataPromise,
    Promise.all([
      listTransactions({ householdId: household.id, fromDate, toDate, reportMonthFrom: selectedMonth, reportMonthTo: selectedMonth, categoryId: selectedCategory, subcategoryId: selectedSubcategory, recurringRuleId: selectedRecurringRule }),
      listTransactions({ householdId: household.id }),
    ]),
  ]);

  const budgetCategories = categories.filter((c) => c.transactionType === 'expense');
  const categoryFilterName = selectedCategory ? categories.find((category) => category.id === selectedCategory)?.name : null;
  const subcategoryFilterName = selectedSubcategory ? categories.flatMap((category) => category.subcategories).find((subcategory) => subcategory.id === selectedSubcategory)?.name : null;
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);
  const budgets = annualBudgets.filter((budget) => budget.month === monthNumber);

  return (
    <div className="tds-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="tds-title mb-2">월간 내역을 관리해요</h1>
          <p className="text-sm text-[var(--tds-grey-700)]">{fromDate} ~ {toDate} · 활성 반복항목은 예정 거래로 자동 채워져요.</p>
          {(categoryFilterName || subcategoryFilterName || selectedRecurringRule) && <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--tds-blue-50)] px-3 py-1.5 text-xs font-semibold text-[var(--tds-blue-600)]">{selectedRecurringRule ? '연결된 예정거래만 보는 중' : `${subcategoryFilterName ?? categoryFilterName} 거래만 보는 중`} <Link href={`/monthly?month=${selectedMonth}`} className="underline underline-offset-2">필터 해제</Link></p>}
        </div>
        <nav aria-label="월 선택" className="flex items-center gap-2">
          <Link href={`/monthly?month=${shiftMonth(selectedMonth, -1)}`} className="home-arrow" aria-label="이전 달">←</Link>
          <strong className="min-w-28 text-center text-base">{monthLabel(selectedMonth)}</strong>
          <Link href={`/monthly?month=${shiftMonth(selectedMonth, 1)}`} className="home-arrow" aria-label="다음 달">→</Link>
        </nav>
      </div>
      <MonthlyPageTabs
        transactions={transactions}
        allTransactions={allTransactions}
        selectedMonth={selectedMonth}
        categories={categories}
        paymentMethods={activePaymentMethods}
        budgets={budgets}
        budgetCategories={budgetCategories}
      />
    </div>
  );
}
