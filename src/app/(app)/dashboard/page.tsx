import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { resolveDashboardRange, type DashboardPreset } from '@/lib/dashboard-calculations';
import { getDashboardHomeSummary, type HomeMonth, type HomeRank } from '@/lib/dashboard-home';
import { computeCurrentNetWorth, listAssetValueHistory } from '@/lib/snapshots';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { DashboardPrimaryTabs } from './DashboardPrimaryTabs';
import { DashboardAssetOverview } from './DashboardAssetOverview';
import { DashboardCashflowOverview } from './DashboardCashflowOverview';
import { DashboardCategoryBarChart } from './DashboardCategoryBarChart';
import { DashboardDebtOverview } from './DashboardDebtOverview';
import { DashboardRiskOverview } from './DashboardRiskOverview';
import { DashboardMonthlyDetail } from './DashboardMonthlyDetail';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import type { HomeRecent } from '@/lib/dashboard-home';
import { listInsurances } from '@/lib/insurances';
import { listAssets } from '@/lib/assets';
import { listLoans } from '@/lib/loans';
import { listTransactions, getTransactionYearRange, type Transaction } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { buildAmortizationSchedule, paymentMonthsInclusive } from '@/lib/loan-calculations';

const won = new Intl.NumberFormat('ko-KR');
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const money = (value: number | null | undefined) => value == null ? '-' : `${won.format(Math.round(value))}원`;
const monthLabel = (month: string) => `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;
const monthBounds = (month: string) => { const range = monthRangeFromSeoulDateString(`${month}-01`); return { from: range.fromDate, to: range.toDate }; };
const shiftMonth = (month: string, offset: number) => { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const reportMonth = (transaction: { sourceMonth?: string | null; transactionDate: string }) => transaction.sourceMonth ?? transaction.transactionDate.slice(0, 7);

// §"월별 상세" 연도 선택기(2026-09) — 기존에는 이 세 함수의 로직이 DashboardPage 본문에 "최근 12개월"
// 창(month 기준 상대값) 하나에만 인라인으로 박혀 있었다. 연도 선택을 지원하려면 임의의 캘린더 연도
// 12개월에 대해서도 똑같은 계산이 필요해서, 로직은 그대로 두고 인자만 받도록 추출했다 — 기존 트렌드
// 차트용 호출과 새 "선택 연도" 호출이 정확히 같은 규칙을 쓰게 하기 위함(중복 구현으로 인한 값 불일치 방지).
function buildTransactionDetails(transactions: Transaction[]) {
  const details = transactions.filter((t) => t.status === 'posted' && t.transactionType !== 'income' && (t.flowClass === 'consumption' || t.transactionType === 'refund')).map((t) => ({ month: reportMonth(t), id: t.categoryId ?? 'unassigned', label: '', value: t.amount, subcategories: [{ id: t.id, label: `${t.transactionDate} · ${t.description}`, value: t.transactionType === 'refund' ? -t.amount : t.amount }] }));
  details.push(...transactions.filter((t) => t.status === 'posted' && t.transactionType === 'income').map((t) => ({ month: reportMonth(t), id: t.subcategoryId ?? 'income:other', label: '', value: t.amount, subcategories: [{ id: t.id, label: `${t.transactionDate} · ${t.description}`, value: t.amount }] })));
  return details;
}
function buildExpenseMonthlyDetail(transactions: Transaction[], months: string[], expenseCategoryNames: Map<string, string>) {
  return months.map((target) => {
    const rows = new Map<string, { id: string; label: string; value: number; subcategories: { id: string; label: string; value: number }[] }>();
    transactions.filter((t) => t.status === 'posted' && t.transactionType !== 'income' && (t.flowClass === 'consumption' || t.transactionType === 'refund') && reportMonth(t) === target).forEach((t) => {
      const id = t.categoryId ?? 'unassigned';
      const row = rows.get(id) ?? { id, label: expenseCategoryNames.get(id) ?? '미분류', value: 0, subcategories: [] };
      const value = t.transactionType === 'refund' ? -t.amount : t.amount;
      row.value += value; row.subcategories.push({ id: t.id, label: `${t.transactionDate} · ${t.description}`, value });
      rows.set(id, row);
    });
    return { month: target, total: [...rows.values()].reduce((sum, row) => sum + row.value, 0), categories: [...rows.values()].sort((a, b) => b.value - a.value) };
  });
}
function buildIncomeMonthlyDetail(transactions: Transaction[], months: string[], incomeSubcategoryNames: Map<string, string>) {
  return months.map((target) => {
    const rows = new Map<string, { id: string; label: string; value: number; subcategories: { id: string; label: string; value: number }[] }>();
    transactions.filter((t) => t.status === 'posted' && t.transactionType === 'income' && reportMonth(t) === target).forEach((t) => {
      const id = t.subcategoryId ?? 'income:other';
      const row = rows.get(id) ?? { id, label: incomeSubcategoryNames.get(id) ?? '기타 수입', value: 0, subcategories: [] };
      row.value += t.amount; row.subcategories.push({ id: t.id, label: `${t.transactionDate} · ${t.description}`, value: t.amount });
      rows.set(id, row);
    });
    return { month: target, total: [...rows.values()].reduce((sum, row) => sum + row.value, 0), categories: [...rows.values()].sort((a, b) => b.value - a.value) };
  });
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; preset?: string; customFrom?: string; customTo?: string; detailYear?: string }> }) {
  const query = await searchParams; const today = todayInSeoul(); const currentMonth = today.slice(0, 7); const month = query.month && monthPattern.test(query.month) ? query.month : currentMonth; const trendStart = shiftMonth(month, -23); const bounds = monthBounds(month); const preset: DashboardPreset = 'month'; const dashboardRange = resolveDashboardRange(bounds.to, preset); const household = await ensureHouseholdForCurrentUser();
  // "월별 상세" 위젯의 연도 선택기(2026-09). 위의 24개월 트렌드 창(month 기준 상대값)과는 별개로,
  // 사용자가 임의의 캘린더 연도를 고를 수 있어야 한다 — 마이그레이션으로 2023년 말~2026년 데이터가
  // 들어와 있는데, 기존 창은 항상 "오늘 기준 최근 24개월"이라 그보다 오래된 연도는 볼 방법이 없었다.
  const detailYear = query.detailYear && /^\d{4}$/.test(query.detailYear) ? query.detailYear : month.slice(0, 4);
  const detailFrom = `${detailYear}-01-01`; const detailTo = `${detailYear}-12-31`;
  const detailMonths = Array.from({ length: 12 }, (_, index) => `${detailYear}-${String(index + 1).padStart(2, '0')}`);
  const referenceDataPromise = Promise.all([
    computeCurrentNetWorth(household.id, today),
    listAssetValueHistory(household.id, 36),
    listInsurances(household.id),
    listAssets(household.id),
    listLoans(household.id),
    listCategoriesWithSubcategories(household.id),
    getTransactionYearRange(household.id),
  ]);
  // The dashboard only needs planned rows for the selected month. Materializing the
  // entire 24-month chart range made every visit perform avoidable database writes.
  await materializeRecurringRulesForRange(household.id, bounds.from, bounds.to);
  const [summary, transactions, detailSummary, detailTransactions, referenceData] = await Promise.all([
    getDashboardHomeSummary({ householdId: household.id, from: dashboardRange.from < `${trendStart}-01` ? dashboardRange.from : `${trendStart}-01`, to: bounds.to, monthStart: dashboardRange.from, monthEnd: dashboardRange.to }),
    listTransactions({ householdId: household.id, fromDate: `${trendStart}-01`, toDate: bounds.to, reportMonthFrom: trendStart, reportMonthTo: month }),
    getDashboardHomeSummary({ householdId: household.id, from: detailFrom, to: detailTo, monthStart: detailFrom, monthEnd: detailTo }),
    listTransactions({ householdId: household.id, fromDate: detailFrom, toDate: detailTo, reportMonthFrom: `${detailYear}-01`, reportMonthTo: `${detailYear}-12` }),
    referenceDataPromise,
  ]);
  const [netWorth, assetHistory, insurances, realAssets, loans, categories, transactionYearRange] = referenceData;
  const incomeSubcategoryNames = new Map(categories.find((category) => category.transactionType === 'income')?.subcategories.map((subcategory) => [subcategory.id, subcategory.name]) ?? []);
  const expenseCategoryNames = new Map(categories.filter((category) => category.transactionType === 'expense').map((category) => [category.id, category.name]));
  // transactionDetails/monthlyExpenseDetail are no longer computed for this trailing-24mo window —
  // DashboardMonthlyDetail now gets its category/subcategory drill-down from the detailYear-scoped
  // versions below. incomeMonthlyDetail stays: it's the source of incomeCurrentDetail, the RPC-backed
  // fallback for the true pinned current month (independent of whichever year detailYear browses to).
  const monthlyByMonth = new Map(summary.monthly.map((item) => [item.month, item])); const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11)); const incomeMonthlyDetail = buildIncomeMonthlyDetail(transactions, months, incomeSubcategoryNames); const incomeCurrentDetail = incomeMonthlyDetail.find((item) => item.month === month)?.categories ?? []; const monthlyTrend = months.map((target) => deriveMonth(monthlyByMonth.get(target) ?? emptyMonth(target))); const monthCurrent = deriveMonth(monthlyByMonth.get(month) ?? emptyMonth(month)); const current = monthCurrent; const categoryRows = summary.categories; const paymentRows = summary.payments;
  // "월별 상세" 위젯 전용 — 위 monthlyTrend/incomeMonthlyDetail 등(트렌드 차트·현재 달 요약용, 오늘
  // 기준 상대 24개월 창)과는 다른, 선택된 캘린더 연도(detailYear) 12개월 기준 데이터.
  const detailMonthlyByMonth = new Map(detailSummary.monthly.map((item) => [item.month, item]));
  const detailMonthlyTrend = detailMonths.map((target) => deriveMonth(detailMonthlyByMonth.get(target) ?? emptyMonth(target)));
  const detailIncomeMonthlyDetail = buildIncomeMonthlyDetail(detailTransactions, detailMonths, incomeSubcategoryNames);
  const detailExpenseMonthlyDetail = buildExpenseMonthlyDetail(detailTransactions, detailMonths, expenseCategoryNames);
  const detailTransactionDetails = buildTransactionDetails(detailTransactions);
  const availableYears = transactionYearRange ? Array.from({ length: transactionYearRange.maxYear - transactionYearRange.minYear + 1 }, (_, i) => transactionYearRange.minYear + i) : [Number(detailYear)];
  const history = [...assetHistory.filter((item) => item.snapshotMonth.slice(0, 7) !== currentMonth), { id: 'current', snapshotMonth: `${currentMonth}-01`, totalAssets: netWorth.totalAssets, source: 'live' }].sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth)).slice(-12); const debtRatio = netWorth.totalAssets > 0 ? netWorth.totalDebt / netWorth.totalAssets : 0;
  const assetRows = [{ label: '현금·입출금', value: netWorth.cashAssets, color: 'var(--tds-blue-500)' }, { label: '예금', value: netWorth.depositAssets, color: '#6b8afd' }, { label: '적금', value: netWorth.savingsAssets, color: 'var(--tds-green-500)' }, { label: '투자', value: netWorth.investmentAssets, color: '#8b5cf6' }, { label: '부동산·자동차', value: netWorth.nonFinancialAssets, color: '#f59e0b' }].filter((item) => item.value > 0);
  const annualDebt = new Map<number, { balance: number; principal: number; interest: number }>(); loans.filter((loan) => loan.status === 'active').forEach((loan) => { const schedule = buildAmortizationSchedule({ principal: loan.originalAmount, annualRate: loan.annualRate, termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate), graceMonths: loan.graceMonths, method: loan.repaymentMethod, firstPaymentDate: loan.firstPaymentDate }); schedule.forEach((row) => { const year = Number(row.paymentDate.slice(0, 4)); const existing = annualDebt.get(year) ?? { balance: row.remainingBalance, principal: 0, interest: 0 }; annualDebt.set(year, { balance: existing.balance + row.remainingBalance, principal: existing.principal + row.principalPayment, interest: existing.interest + row.interestPayment }); }); }); const annualDebtRows = [...annualDebt.entries()].map(([year, row]) => ({ year, ...row })).sort((a, b) => a.year - b.year);

  return <div data-page="home" className="tds-page home-page">
    <header className="tds-page-header"><div><p className="tds-eyebrow">우리집 재무</p><h1 className="tds-title">가계 재무 대시보드</h1><p className="tds-page-subtitle">기준 월: {monthLabel(month)} · 실제로 확정된 데이터를 기준으로 보여줍니다.</p></div></header>
    {(summary.reviewCount > 0 || summary.plannedCount > 0) && <aside className="dashboard-alert-strip" aria-label="확인할 알림"><span aria-hidden="true">●</span><div><strong>확인할 일이 있어요</strong><p>{summary.reviewCount > 0 ? `검토가 필요한 거래 ${summary.reviewCount}건` : ''}{summary.reviewCount > 0 && summary.plannedCount > 0 ? ' · ' : ''}{summary.plannedCount > 0 ? `예정 거래 ${summary.plannedCount}건` : ''}</p></div><Link href="/monthly" prefetch className="tds-text-link">월간관리에서 확인</Link></aside>}

    {/* §7 item 1 — 이번 달 요약은 탭 안이 아니라 페이지 최상단에 고정한다. */}
    <MonthSummary current={current} />

    <DashboardPrimaryTabs
      asset={<>
        <DashboardAssetOverview totalAssets={netWorth.totalAssets} totalDebt={netWorth.totalDebt} netWorth={netWorth.netWorth} debtRatio={debtRatio} assetRows={assetRows} history={history.map((item) => ({ month: item.snapshotMonth, value: item.totalAssets }))} liquidCash={netWorth.cashAssets} monthlyConsumption={current.consumption} realAssets={realAssets.filter((item) => item.status === 'active').map((item) => ({ id: item.id, assetName: item.assetName, currentValue: item.currentValue }))} />
      </>}
      monthly={<>
        {/* §7 items 2 → 6, §16 웹 레퍼런스: 데스크톱 폭에서는 요약/리스트류(좌)와
         * 차트류(우)를 2컬럼으로 나란히 배치해 넓은 화면을 활용한다. 모바일/태블릿
         * (< 1024px)에서는 .dashboard-monthly-columns가 1열로 접혀 순서가 지금과 동일하다. */}
        <div className="dashboard-monthly-columns">
          <div className="dashboard-monthly-column">
            <BudgetMeter total={summary.budgetTotal} actual={summary.budgetActual} />
            <PlannedTransactions plannedCount={summary.plannedCount} />
            <RecentTransactions rows={summary.recent} />
          </div>
          <div className="dashboard-monthly-column">
            <DashboardCashflowOverview monthly={monthlyTrend} />
            <DashboardCategoryBarChart rows={categoryRows} />
          </div>
        </div>
        {/* 드릴다운은 이미 내부에 여러 섹션을 가진 넓은 컴포넌트라 컬럼에 넣지 않고 전체 폭 유지. */}
        <DashboardMonthlyDetail selectedMonth={month} detailYear={detailYear} availableYears={availableYears} monthly={detailMonthlyTrend} incomeMonthly={detailIncomeMonthlyDetail} incomeCurrent={incomeCurrentDetail} expenseMonthly={detailExpenseMonthlyDetail} expenseCurrent={categoryRows} expensePayments={paymentRows} transactionDetails={detailTransactionDetails} />
      </>}
      debt={<DashboardDebtOverview totalDebt={netWorth.totalDebt} debtRatio={debtRatio} principal={current.debtPrincipal} financeCost={current.financeCost} annual={annualDebtRows} />}
      risk={<DashboardRiskOverview insurances={insurances} />}
    />
  </div>;
}

export function RankedRows({ rows, total, empty, href }: { rows: HomeRank[]; total: number; empty: string; href?: (id: string) => string }) { const max = rows[0]?.value ?? 1; return <div className="home-ranked-list">{rows.slice(0, 6).map((row, index) => { const content = <><span className="home-rank">{index + 1}</span><div><p><span>{row.label}</span><strong>{money(row.value)}</strong></p><div><span style={{ width: `${row.value / max * 100}%` }} /></div><small>{total > 0 ? `${(row.value / total * 100).toFixed(1)}%` : '0%'}</small>{row.subcategories?.length ? <div className="mt-2 border-l-2 border-[var(--tds-grey-200)] pl-3">{row.subcategories.slice(0, 5).map((sub) => <Link key={sub.id} href={href ? `${href(row.id)}&subcategory=${sub.id}` : '#'} className="flex items-center justify-between py-1 text-xs text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]"><span>{sub.label}</span><b>{money(sub.value)}</b></Link>)}</div> : null}</div></>; return row.subcategories?.length ? <div key={row.id} className="home-ranked-row">{content}</div> : href ? <Link key={row.id} href={href(row.id)} className="home-ranked-row" prefetch>{content}</Link> : <div key={row.id} className="home-ranked-row">{content}</div>; })}{!rows.length && <Empty text={empty} />}</div>; }
function Empty({ text }: { text: string }) { return <p className="home-empty">{text}</p>; }

/* §7 item 1 — 수입 / 지출 / 잔액.  세 칸의 산식이 서로 맞도록 "지출"은 총지출
 * (소비성 + 금융비용 + 저축·투자·원금상환)으로 두었다: 수입 − 지출 = 잔액이고,
 * 잔액은 deriveMonth가 이미 계산해 둔 cashRemaining 그대로다. */
function MonthSummary({ current }: { current: ReturnType<typeof deriveMonth> }) {
  const spent = current.consumption + current.financeCost + current.wealthBuilt;
  const share = (value: number, base: number) => base > 0 ? `${(value / base * 100).toFixed(0)}%` : '-';
  return <section className="tds-summary-grid" aria-label="이번 달 요약">
    <StatCard label="이번 달 수입" value={<Amount value={current.income} type="income" size="large" />} meta="확정된 수입 합계" />
    <StatCard label="이번 달 지출" value={<Amount value={spent} type="expense" size="large" />} meta={`소비성 ${share(current.consumption, spent)} · 저축·투자·상환 ${share(current.wealthBuilt, spent)}`} />
    <StatCard label="이번 달 잔액" value={<Amount value={Math.abs(current.cashRemaining)} type={current.cashRemaining >= 0 ? 'income' : 'expense'} size="large" showSign />} meta={current.income > 0 ? `수입의 ${share(current.cashRemaining, current.income)}` : '수입 − 지출'} />
  </section>;
}

/* §7 item 2 — budgetTotal/budgetActual은 RPC가 이미 반환하는데 화면 어디에도
 * 노출되지 않았다.  예산 초과 여부는 색 하나로 읽히는 게 핵심이라 진행률 바로 둔다. */
function BudgetMeter({ total, actual }: { total: number; actual: number }) {
  const ratio = total > 0 ? actual / total : 0;
  const state = ratio > 1 ? 'over' : ratio >= 0.9 ? 'near' : 'within';
  const remaining = total - actual;
  return <section className="tds-card tds-section-card" aria-label="예산 대비 지출">
    <SectionHeader title="예산 대비 지출" description={total > 0 ? '이번 달 예산과 확정 지출을 비교합니다.' : '이번 달 예산이 설정되지 않았습니다.'} action={<Link href="/settings/budgets" prefetch className="tds-text-link">예산 설정</Link>} />
    {total > 0 ? <div className="tds-budget-meter">
      <div className="tds-budget-meter-head"><Amount value={actual} type="expense" size="medium" /><span className="tds-budget-meter-ratio">{(ratio * 100).toFixed(0)}%</span></div>
      <div className="tds-progress" role="img" aria-label={`예산 ${money(total)} 중 ${money(actual)} 사용 · ${(ratio * 100).toFixed(0)}%`}><span className={`tds-progress-fill tds-progress-fill-${state}`} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} /></div>
      <div className="tds-budget-meter-foot"><span>예산 <Amount value={total} size="small" /></span><span>{remaining >= 0 ? <>남은 예산 <Amount value={remaining} size="small" /></> : <>초과 <Amount value={Math.abs(remaining)} type="expense" size="small" /></>}</span></div>
    </div> : <EmptyState title="예산이 없어요" description="연간 예산을 설정하면 이번 달 지출과 비교해 보여드립니다." />}
  </section>;
}

/* §7 item 5 — dashboard_home_summary는 예정 거래의 "건수"만 반환하고 행 목록은
 * 반환하지 않는다(HomeRecent에 status 필드가 없다).  새 RPC를 만들지 않는다는
 * §7 원칙에 따라 요약 한 줄 + 월간관리 이동으로 처리한다. */
function PlannedTransactions({ plannedCount }: { plannedCount: number }) {
  return <section className="tds-card tds-section-card" aria-label="예정 거래">
    <SectionHeader title="예정 거래" description="정기거래에서 만들어졌지만 아직 확정하지 않은 거래입니다." />
    <div className="tds-section-card-list">
      {plannedCount > 0
        ? <ListItem title={`확정을 기다리는 거래 ${plannedCount}건`} description="월간관리에서 확정하거나 이번 달 제외로 처리할 수 있어요." trailing={<Link href="/monthly" prefetch className="tds-button-secondary">월간관리로 이동</Link>} />
        : <EmptyState title="예정 거래가 없어요" description="이번 달 정기거래가 모두 처리되었습니다." />}
    </div>
  </section>;
}

/* §7 item 6 — 최근 거래.  §14 정보 위계(금액 > 거래내용 > 보조정보)대로
 * 금액은 우측 Amount, 수입/지출은 아이콘이 아니라 색과 부호로만 구분한다. */
function RecentTransactions({ rows }: { rows: HomeRecent[] }) {
  return <section className="tds-card tds-section-card" aria-label="최근 거래">
    <SectionHeader title="최근 거래" description="가장 최근에 기록된 거래입니다." action={<Link href="/monthly" prefetch className="tds-text-link">전체 보기</Link>} />
    <div className="tds-section-card-list">
      {rows.length
        ? rows.map((row) => <ListItem key={row.id} title={row.description || '내용 없음'} metadata={row.transactionDate} trailing={<Amount value={row.amount} type={row.transactionType === 'income' ? 'income' : 'expense'} size="small" showSign />} />)
        : <EmptyState title="최근 거래가 없어요" description="거래를 기록하면 이곳에 최근 순으로 보여드립니다." />}
    </div>
  </section>;
}
function emptyMonth(month: string): HomeMonth { return { month, income: 0, consumption: 0, fixedConsumption: 0, variableConsumption: 0, saving: 0, investment: 0, debtPrincipal: 0, financeCost: 0 }; }
function deriveMonth(value: HomeMonth) { const wealthBuilt = value.saving + value.investment + value.debtPrincipal; return { ...value, wealthBuilt, cashRemaining: value.income - value.consumption - value.financeCost - wealthBuilt }; }
