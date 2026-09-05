'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Amount } from '@/components/Amount';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { Budget } from '@/lib/budgets';
import type { TransactionSummary } from '@/lib/transactions';
import { dailyCashflow, monthlyCashflow, periodTotals, reportMonthOf } from '@/lib/analysis';
import { AnalysisCashflowChart } from './AnalysisCashflowChart';
import { AnalysisIncomeView } from './AnalysisIncomeView';
import { AnalysisExpenseView } from './AnalysisExpenseView';
import { AnalysisReferenceView } from './AnalysisReferenceView';
import { AnalysisCardView } from './AnalysisCardView';
import { AnnualReportView } from './AnnualReportView';

function monthEnd(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

// 2026-09(사용자 지시: "분석쪽 화면 다시 재정리가 필요하겠네... 연간 탭 누르면 이번에 개편한
// 연간 리포트 화면이 바로 표시되고... 수입/지출/참고거래/카드사용 등 영역과 기능 모두 삭제.
// 월간 누르면... 수입/지출/카드사용/참고거래를 하나로 묶은 화면을... 수입 > 지출 > 카드사용 >
// 참고 거래 순으로 아코디언 적용해") — 예전에는 수입/지출/참고거래/카드사용/연간리포트 5개를
// 탭으로 골라 보던 걸, 스코프 하나로 완전히 대체한다: 연간=엑셀 그대로 보는 화면 하나만,
// 월간=드릴다운 4종을 순서대로 펼쳐보는 아코디언 하나만.
type MonthSectionKey = 'income' | 'expense' | 'card' | 'reference';
const MONTH_SECTIONS: { key: MonthSectionKey; label: string }[] = [
  { key: 'income', label: '수입' },
  { key: 'expense', label: '지출' },
  { key: 'card', label: '카드 사용' },
  { key: 'reference', label: '참고 거래' },
];

function shiftMonth(month: string, offset: number) {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// §4 — 분석 화면 뼈대. [연간]/[월간] 스코프를 한 페이지에서 전환한다. 연도가 바뀌면 서버에서 그
// 해 데이터를 새로 받아야 해서 Link(전체 새 렌더)로 처리하고(dashboard의 연도 선택기와 같은
// 패턴), scope/월 전환은 이미 받은 1년치 데이터 안에서 클라이언트 상태로만 처리한다.
export function AnalysisWorkspace({ initialScope, year, initialMonth, initialOpenSection, availableYears, categories, paymentMethods, budgets, transactions }: {
  initialScope: 'year' | 'month';
  year: string;
  initialMonth: string;
  initialOpenSection: MonthSectionKey;
  availableYears: number[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  budgets: Budget[];
  transactions: TransactionSummary[];
}) {
  const [scope, setScope] = useState(initialScope);
  const [month, setMonth] = useState(initialMonth);
  const selectedMonthRef = useRef<HTMLButtonElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (scope !== 'month') return;
    selectedMonthRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [scope, month, year]);

  // 연도 선택기는 서버에서 새 1년치 데이터를 받아야 하므로 Link다 — 다른 연도로 바뀌면 그 해
  // 기본 달로 재동기화한다(dashboard/DashboardMonthlyDetail의 syncedYear와 같은 패턴).
  const [syncedYear, setSyncedYear] = useState(year);
  if (year !== syncedYear) { setSyncedYear(year); setMonth(initialMonth); }
  const yearHref = (y: number) => { const params = new URLSearchParams(searchParams.toString()); params.set('year', String(y)); return `?${params.toString()}`; };

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`), [year]);
  const incomeSubcategoryNames = useMemo(() => new Map(categories.find((c) => c.transactionType === 'income')?.subcategories.map((s) => [s.id, s.name]) ?? []), [categories]);
  const expenseCategoryNames = useMemo(() => new Map(categories.filter((c) => c.transactionType === 'expense').map((c) => [c.id, c.name])), [categories]);
  // 카드 사용의 개별 거래는 참고 거래도 섞여 있고, 참고 거래는 수입/지출 대분류 어느 쪽이든
  // categoryId로 가질 수 있어서(§4) expenseCategoryNames만으로는 못 찾는 경우가 생긴다 — 두
  // 유형을 합친 맵을 따로 둔다.
  const allCategoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const expenseSubcategoryNames = useMemo(() => { const map = new Map<string, string>(); for (const c of categories) for (const s of c.subcategories) map.set(s.id, s.name); return map; }, [categories]);
  const paymentMethodNames = useMemo(() => new Map(paymentMethods.map((m) => [m.id, m.name])), [paymentMethods]);
  const savingsCategoryId = categories.find((c) => c.name === '저축성지출')?.id ?? null;

  const periodTransactions = useMemo(() => scope === 'year'
    ? transactions.filter((t) => reportMonthOf(t).slice(0, 4) === year)
    : transactions.filter((t) => reportMonthOf(t) === month), [scope, month, year, transactions]);
  const previousMonth = shiftMonth(month, -1);
  const previousMonthTransactions = useMemo(() => transactions.filter((t) => reportMonthOf(t) === previousMonth), [transactions, previousMonth]);

  const totals = periodTotals(periodTransactions, savingsCategoryId);
  const previousTotals = periodTotals(previousMonthTransactions, savingsCategoryId);
  const monthCount = scope === 'year' ? months.filter((m) => transactions.some((t) => reportMonthOf(t) === m)).length || 12 : 1;
  const label = scope === 'year' ? `${year}년` : `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
  const monthlyPoints = useMemo(() => scope === 'year' ? monthlyCashflow(transactions, months, savingsCategoryId) : [], [scope, transactions, months, savingsCategoryId]);
  const dailyPoints = useMemo(() => scope === 'month' ? dailyCashflow(transactions, `${month}-01`, monthEnd(month), savingsCategoryId) : [], [scope, transactions, month, savingsCategoryId]);

  return <div className="analysis-page tds-page flex flex-col gap-5">
    <PageHeader eyebrow="분석" title="수입·지출을 자세히 살펴봐요" description="연간·월간을 전환하며 대분류부터 개별 거래까지 확인할 수 있어요." />

    <div className="analysis-controls">
      <div className="home-explorer-tabs" role="tablist" aria-label="기간 단위"><button type="button" role="tab" aria-selected={scope === 'month'} className={scope === 'month' ? 'is-selected' : ''} onClick={() => setScope('month')}>월간</button><button type="button" role="tab" aria-selected={scope === 'year'} className={scope === 'year' ? 'is-selected' : ''} onClick={() => setScope('year')}>연간</button></div>
      <div className="home-month-selector" aria-label="연도 선택">{availableYears.map((y) => <Link key={y} href={yearHref(y)} scroll={false} className={String(y) === year ? 'is-selected' : ''}>{y}년</Link>)}</div>
      {scope === 'month' && <div className="home-month-selector" aria-label="월 선택">{months.map((m) => <button type="button" key={m} ref={m === month ? selectedMonthRef : undefined} aria-pressed={m === month} className={m === month ? 'is-selected' : ''} onClick={() => setMonth(m)}>{Number(m.slice(5, 7))}월</button>)}</div>}
    </div>

    <AnalysisSummary scope={scope} label={label} totals={totals} previousTotals={scope === 'month' ? previousTotals : null} monthCount={monthCount} />
    <AnalysisCashflowChart scope={scope} monthly={monthlyPoints} daily={dailyPoints} />

    {scope === 'year'
      ? <AnnualReportView year={year} months={months} periodTransactions={periodTransactions} categories={categories} paymentMethods={paymentMethods} />
      : <div className="flex flex-col gap-4">
          {MONTH_SECTIONS.map(({ key, label: sectionLabel }) => <details key={key} className="tds-accordion" open={key === initialOpenSection}>
            <summary><strong>{sectionLabel}</strong></summary>
            <div className="tds-accordion-body">
              {key === 'income' && <AnalysisIncomeView periodTransactions={periodTransactions} subcategoryNames={incomeSubcategoryNames} />}
              {key === 'expense' && <AnalysisExpenseView month={month} periodTransactions={periodTransactions} categoryNames={expenseCategoryNames} subcategoryNames={expenseSubcategoryNames} budgets={budgets} categories={categories} totals={totals} />}
              {key === 'card' && <AnalysisCardView periodTransactions={periodTransactions} paymentMethods={paymentMethods} categoryNames={allCategoryNames} />}
              {key === 'reference' && <AnalysisReferenceView periodTransactions={periodTransactions} paymentMethodNames={paymentMethodNames} subcategoryNames={expenseSubcategoryNames} />}
            </div>
          </details>)}
        </div>}
  </div>;
}

function AnalysisSummary({ scope, label, totals, previousTotals, monthCount }: { scope: 'year' | 'month'; label: string; totals: ReturnType<typeof periodTotals>; previousTotals: ReturnType<typeof periodTotals> | null; monthCount: number }) {
  const incomeChange = previousTotals ? totals.income - previousTotals.income : null;
  const expenseChange = previousTotals ? totals.expense - previousTotals.expense : null;
  return <section className="tds-summary-grid" aria-label={`${label} 요약`}>
    <StatCard label={scope === 'year' ? '연간 수입' : `${label} 수입`} value={<Amount value={totals.income} type="income" size="large" />} meta={scope === 'year' ? `월평균 ${money(totals.income / monthCount)}` : (incomeChange === null ? '확정 수입 합계' : `전월 대비 ${incomeChange >= 0 ? '+' : ''}${money(incomeChange)}`)} />
    <StatCard label={scope === 'year' ? '연간 총지출' : `${label} 총지출`} value={<Amount value={totals.expense} type="expense" size="large" />} meta={scope === 'year' ? `월평균 ${money(totals.expense / monthCount)}` : (expenseChange === null ? '확정 지출 합계' : `전월 대비 ${expenseChange >= 0 ? '+' : ''}${money(expenseChange)}`)} />
    <StatCard label="저축성 지출" value={<Amount value={totals.savings} type="expense" size="large" />} meta="총지출에 포함된 금액" />
    <StatCard label="순현금흐름" value={<Amount value={Math.abs(totals.net)} type={totals.net >= 0 ? 'income' : 'expense'} size="large" showSign />} meta={totals.income > 0 ? `수입의 ${(totals.net / totals.income * 100).toFixed(1)}%` : '수입 − 지출'} />
  </section>;
}
