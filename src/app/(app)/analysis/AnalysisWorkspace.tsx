'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Amount } from '@/components/Amount';
import { StatCard } from '@/components/StatCard';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { Budget } from '@/lib/budgets';
import type { Transaction } from '@/lib/transactions';
import { dailyCashflow, monthlyCashflow, periodTotals, reportMonthOf } from '@/lib/analysis';
import { AnalysisCashflowChart } from './AnalysisCashflowChart';
import { AnalysisIncomeView } from './AnalysisIncomeView';
import { AnalysisExpenseView } from './AnalysisExpenseView';
import { AnalysisReferenceView } from './AnalysisReferenceView';
import { AnalysisCardView } from './AnalysisCardView';

function monthEnd(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const TYPE_LABEL = { income: '수입', expense: '지출', reference: '참고 거래', card: '카드 사용' } as const;
export type AnalysisType = keyof typeof TYPE_LABEL;

function shiftMonth(month: string, offset: number) {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// §4 — 분석 화면 뼈대. [연간]/[월간] 스코프와 [수입]/[지출]/[참고 거래]/[카드 사용] 타입 탭을 한
// 페이지에서 전환한다. 연도가 바뀌면 서버에서 그 해 데이터를 새로 받아야 해서 Link(전체 새
// 렌더)로 처리하고(dashboard의 연도 선택기와 같은 패턴), scope/월/타입 전환은 이미 받은 1년치
// 데이터 안에서 클라이언트 상태로만 처리한다.
export function AnalysisWorkspace({ initialScope, year, initialMonth, initialType, availableYears, categories, paymentMethods, budgets, transactions }: {
  initialScope: 'year' | 'month';
  year: string;
  initialMonth: string;
  initialType: AnalysisType;
  availableYears: number[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
  budgets: Budget[];
  transactions: Transaction[];
}) {
  const [scope, setScope] = useState(initialScope);
  const [month, setMonth] = useState(initialMonth);
  const [type, setType] = useState<AnalysisType>(initialType);
  const searchParams = useSearchParams();

  // 연도 선택기는 서버에서 새 1년치 데이터를 받아야 하므로 Link다 — 다른 연도로 바뀌면 그 해
  // 기본 달로 재동기화한다(dashboard/DashboardMonthlyDetail의 syncedYear와 같은 패턴).
  const [syncedYear, setSyncedYear] = useState(year);
  if (year !== syncedYear) { setSyncedYear(year); setMonth(initialMonth); }
  const yearHref = (y: number) => { const params = new URLSearchParams(searchParams.toString()); params.set('year', String(y)); return `?${params.toString()}`; };

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`), [year]);
  const incomeSubcategoryNames = useMemo(() => new Map(categories.find((c) => c.transactionType === 'income')?.subcategories.map((s) => [s.id, s.name]) ?? []), [categories]);
  const expenseCategoryNames = useMemo(() => new Map(categories.filter((c) => c.transactionType === 'expense').map((c) => [c.id, c.name])), [categories]);
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
    <header className="tds-page-header"><div><p className="tds-eyebrow">분석</p><h1 className="tds-title">수입·지출을 자세히 살펴봐요</h1><p className="tds-page-subtitle">연간·월간을 전환하며 대분류부터 개별 거래까지 확인할 수 있어요.</p></div></header>

    <div className="analysis-controls">
      <div className="home-explorer-tabs" role="tablist" aria-label="기간 단위"><button type="button" role="tab" aria-selected={scope === 'month'} className={scope === 'month' ? 'is-selected' : ''} onClick={() => setScope('month')}>월간</button><button type="button" role="tab" aria-selected={scope === 'year'} className={scope === 'year' ? 'is-selected' : ''} onClick={() => setScope('year')}>연간</button></div>
      <div className="home-month-selector" aria-label="연도 선택">{availableYears.map((y) => <Link key={y} href={yearHref(y)} scroll={false} className={String(y) === year ? 'is-selected' : ''}>{y}년</Link>)}</div>
      {scope === 'month' && <div className="home-month-selector" aria-label="월 선택">{months.map((m) => <button type="button" key={m} className={m === month ? 'is-selected' : ''} onClick={() => setMonth(m)}>{Number(m.slice(5, 7))}월</button>)}</div>}
    </div>

    <div className="analysis-type-tabs" role="tablist" aria-label="거래 유형">
      {(Object.keys(TYPE_LABEL) as AnalysisType[]).map((key) => <button key={key} type="button" role="tab" aria-selected={type === key} className={type === key ? 'is-selected' : ''} onClick={() => setType(key)}>{TYPE_LABEL[key]}</button>)}
    </div>

    <AnalysisSummary scope={scope} label={label} totals={totals} previousTotals={scope === 'month' ? previousTotals : null} monthCount={monthCount} />
    <AnalysisCashflowChart scope={scope} monthly={monthlyPoints} daily={dailyPoints} />

    {type === 'income' && <AnalysisIncomeView scope={scope} year={year} months={months} monthCount={monthCount} periodTransactions={periodTransactions} allTransactions={transactions} subcategoryNames={incomeSubcategoryNames} />}
    {type === 'expense' && <AnalysisExpenseView scope={scope} year={year} month={month} months={months} monthCount={monthCount} periodTransactions={periodTransactions} allTransactions={transactions} categoryNames={expenseCategoryNames} subcategoryNames={expenseSubcategoryNames} savingsCategoryId={savingsCategoryId} budgets={budgets} categories={categories} totals={totals} />}
    {type === 'reference' && <AnalysisReferenceView scope={scope} year={year} months={months} periodTransactions={periodTransactions} allTransactions={transactions} paymentMethodNames={paymentMethodNames} subcategoryNames={expenseSubcategoryNames} />}
    {type === 'card' && <AnalysisCardView scope={scope} year={year} months={months} monthCount={monthCount} periodTransactions={periodTransactions} allTransactions={transactions} paymentMethods={paymentMethods} />}
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
