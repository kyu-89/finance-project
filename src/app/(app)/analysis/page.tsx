import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listBudgets } from '@/lib/budgets';
import { listTransactions, getTransactionYearRange } from '@/lib/transactions';
import { AnalysisWorkspace } from './AnalysisWorkspace';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const yearPattern = /^\d{4}$/;
// 2026-09(사용자 지시: "분석쪽 화면 다시 재정리") — 예전에는 이 값이 5개 탭 중 어느 걸 펼치고
// 시작할지를 골랐다. 지금은 탭이 없어졌고(연간=리포트 하나, 월간=4개 아코디언 전부) 월간
// 스코프에서 어느 아코디언을 펼친 채로 시작할지만 고른다 — dashboard/월간관리에서 걸어오는
// 기존 딥링크(`?type=reference`, `?type=expense`)가 계속 의미 있게 동작하도록 이름은
// `type`을 유지한다.
const OPEN_SECTIONS = ['income', 'expense', 'card', 'reference'] as const;
type OpenSection = (typeof OPEN_SECTIONS)[number];

function shiftMonth(month: string, offset: number) {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// "분석" 메뉴(2026-09 신설, 대시보드/월간관리에서 분리) — 연간/월간 전환을 한 페이지에서
// 처리한다(2026-09 재정리: 연간=엑셀 그대로의 연간 리포트 하나, 월간=수입/지출/카드사용/참고
// 거래 아코디언 하나 — 더 이상 탭으로 나뉘어 있지 않다). 연도가 바뀔 때만 서버에서 그 해 1년치
// 거래를 다시 받고(detailYear 패턴을 그대로 재사용 — dashboard/page.tsx의
// DashboardMonthlyDetail이 쓰던 것과 동일), scope/월/아코디언 전환은 이미 받은 데이터 안에서
// 클라이언트 상태로만 처리한다.
export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ scope?: string; year?: string; month?: string; type?: string }> }) {
  const query = await searchParams;
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const previousMonth = shiftMonth(today.slice(0, 7), -1);
  const scope: 'year' | 'month' = query.scope === 'year' ? 'year' : 'month';
  const year = query.year && yearPattern.test(query.year) ? query.year : previousMonth.slice(0, 4);
  const initialMonth = query.month && monthPattern.test(query.month) ? query.month : (year === today.slice(0, 4) ? previousMonth : `${year}-12`);
  const initialOpenSection: OpenSection = OPEN_SECTIONS.includes(query.type as OpenSection) ? (query.type as OpenSection) : 'expense';

  // 전월 대비 비교를 위해 항상 (year-1)년 12월부터 확보한다 — 1월을 선택해도 "전월"(작년 12월)이
  // 이미 로드된 데이터 안에 있어야 서버 왕복 없이 비교할 수 있다.
  const from = `${Number(year) - 1}-12-01`;
  const to = `${year}-12-31`;

  const [categories, paymentMethods, budgets, transactionYearRange, transactions] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listBudgets(household.id, Number(year)),
    getTransactionYearRange(household.id),
    listTransactions({ householdId: household.id, fromDate: from, toDate: to, reportMonthFrom: `${Number(year) - 1}-12`, reportMonthTo: `${year}-12` }),
  ]);

  const availableYears = transactionYearRange
    ? Array.from({ length: transactionYearRange.maxYear - transactionYearRange.minYear + 1 }, (_, i) => transactionYearRange.minYear + i)
    : [Number(year)];

  return <AnalysisWorkspace
    initialScope={scope}
    year={year}
    initialMonth={initialMonth}
    initialOpenSection={initialOpenSection}
    availableYears={availableYears}
    categories={categories}
    paymentMethods={paymentMethods}
    budgets={budgets}
    transactions={transactions}
  />;
}
