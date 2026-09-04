import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions, promotePastPlannedTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
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
  const metadataPromise = Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
  ]);

  if (selectedMonth < currentMonth) {
    // Historical occurrences must exist before their planned status is promoted.
    await materializeRecurringRulesForRange(household.id, fromDate, toDate);
    await promotePastPlannedTransactions(household.id, `${currentMonth}-01`);
  } else {
    // Current/future materialization cannot overlap the historical promotion range.
    await Promise.all([
      promotePastPlannedTransactions(household.id, `${currentMonth}-01`),
      materializeRecurringRulesForRange(household.id, fromDate, toDate),
    ]);
  }

  // 2026-09(사용자 지시: "날짜 기준으로 월별로 데이터 분리 바람") — reportMonthFrom/To(source_month
  // 기준)를 쓰면 실제 transaction_date가 다른 달인데도 원본 엑셀 시트의 소속 월(source_month)
  // 기준으로 이 달에 끼어 보이는 거래가 생겼다("9월인데 8월 거래가 보임"). 월간관리는 화면에
  // 보이는 연월 선택기와 실제 날짜가 항상 일치해야 하므로, source_month는 무시하고 순수
  // transaction_date 범위로만 필터링한다.
  const [[categories, paymentMethods], transactions] = await Promise.all([
    metadataPromise,
    listTransactions({ householdId: household.id, fromDate, toDate, categoryId: selectedCategory, subcategoryId: selectedSubcategory, recurringRuleId: selectedRecurringRule }),
  ]);

  const categoryFilterName = selectedCategory ? categories.find((category) => category.id === selectedCategory)?.name : null;
  const subcategoryFilterName = selectedSubcategory ? categories.flatMap((category) => category.subcategories).find((subcategory) => subcategory.id === selectedSubcategory)?.name : null;
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);

  return (
    <div className="tds-page">
      <div className="monthly-page-header">
        <div><p className="tds-eyebrow">월간 관리</p><h1 className="tds-title">월간 내역을 관리해요</h1>
          <p className="tds-page-subtitle">이번 달 거래를 기록하고 예정 거래를 확인해 주세요.</p>
          {(categoryFilterName || subcategoryFilterName || selectedRecurringRule) && <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--tds-blue-50)] px-3 py-1.5 text-xs font-semibold text-[var(--tds-blue-600)]">{selectedRecurringRule ? '연결된 예정거래만 보는 중' : `${subcategoryFilterName ?? categoryFilterName} 거래만 보는 중`} <Link href={`/monthly?month=${selectedMonth}`} className="underline underline-offset-2">필터 해제</Link></p>}
        </div>
        <nav aria-label="월 선택" className="monthly-month-navigator">
          <Link href={`/monthly?month=${shiftMonth(selectedMonth, -1)}`} className="home-arrow" aria-label="이전 달">←</Link>
          <strong className="min-w-28 text-center text-base">{monthLabel(selectedMonth)}</strong>
          <Link href={`/monthly?month=${shiftMonth(selectedMonth, 1)}`} className="home-arrow" aria-label="다음 달">→</Link>
        </nav>
      </div>
      <MonthlyPageTabs
        transactions={transactions}
        selectedMonth={selectedMonth}
        categories={categories}
        paymentMethods={activePaymentMethods}
      />
    </div>
  );
}
