import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { resolveDashboardRange, type DashboardPreset } from '@/lib/dashboard-calculations';
import { getDashboardHomeSummary, type HomeMonth, type HomeRank } from '@/lib/dashboard-home';
import { computeCurrentNetWorth, listAssetValueHistory } from '@/lib/snapshots';
import { DashboardSpendingExplorer } from './DashboardSpendingExplorer';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { getDashboardIncomeSummary } from '@/lib/dashboard-income';
import { DashboardIncomeExplorer } from './DashboardIncomeExplorer';
import { DashboardPrimaryTabs } from './DashboardPrimaryTabs';
import { getDashboardPaymentSummary } from '@/lib/dashboard-payment';
import { getDashboardMonthlySubcategories } from '@/lib/dashboard-subcategories';
import { DashboardAssetOverview } from './DashboardAssetOverview';
import { DashboardCashflowOverview } from './DashboardCashflowOverview';
import { DashboardDebtOverview } from './DashboardDebtOverview';
import { DashboardRiskOverview } from './DashboardRiskOverview';
import { listInsurances } from '@/lib/insurances';
import { listAssets } from '@/lib/assets';
import { listLoans } from '@/lib/loans';
import { buildAmortizationSchedule, paymentMonthsInclusive } from '@/lib/loan-calculations';

const won = new Intl.NumberFormat('ko-KR');
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const money = (value: number | null | undefined) => value == null ? '-' : `${won.format(Math.round(value))}원`;
const monthLabel = (month: string) => `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;
const monthBounds = (month: string) => { const range = monthRangeFromSeoulDateString(`${month}-01`); return { from: range.fromDate, to: range.toDate }; };
const shiftMonth = (month: string, offset: number) => { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; member?: string; preset?: string; customFrom?: string; customTo?: string }> }) {
  const query = await searchParams; const today = todayInSeoul(); const currentMonth = today.slice(0, 7); const month = query.month && monthPattern.test(query.month) ? query.month : currentMonth; const trendStart = shiftMonth(month, -23); const bounds = monthBounds(month); const preset: DashboardPreset = 'month'; const dashboardRange = resolveDashboardRange(bounds.to, preset); const memberForQuery = undefined; const household = await ensureHouseholdForCurrentUser();
  await materializeRecurringRulesForRange(household.id, `${trendStart}-01`, bounds.to);
  const [summary, incomeSummary, paymentSummary, monthlyDetails, netWorth, assetHistory, insurances, realAssets, loans] = await Promise.all([
    getDashboardHomeSummary({ householdId: household.id, from: dashboardRange.from < `${trendStart}-01` ? dashboardRange.from : `${trendStart}-01`, to: bounds.to, monthStart: dashboardRange.from, monthEnd: dashboardRange.to, memberId: memberForQuery }), getDashboardIncomeSummary({ householdId: household.id, from: dashboardRange.from < `${trendStart}-01` ? dashboardRange.from : `${trendStart}-01`, to: bounds.to, monthStart: dashboardRange.from, monthEnd: dashboardRange.to, memberId: memberForQuery }), getDashboardPaymentSummary({ householdId: household.id, from: `${trendStart}-01`, to: bounds.to, memberId: memberForQuery }), getDashboardMonthlySubcategories({ householdId: household.id, from: `${trendStart}-01`, to: bounds.to, memberId: memberForQuery }), computeCurrentNetWorth(household.id, today, memberForQuery), listAssetValueHistory(household.id, 36), listInsurances(household.id), listAssets(household.id), listLoans(household.id),
  ]);
  const monthlyByMonth = new Map(summary.monthly.map((item) => [item.month, item])); const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11)); const monthlyTrend = months.map((target) => deriveMonth(monthlyByMonth.get(target) ?? emptyMonth(target))); const monthCurrent = deriveMonth(monthlyByMonth.get(month) ?? emptyMonth(month)); const current = monthCurrent; const categoryRows = summary.categories; const paymentRows = summary.payments;
  const history = [...assetHistory.filter((item) => item.snapshotMonth.slice(0, 7) !== currentMonth), { id: 'current', snapshotMonth: `${currentMonth}-01`, totalAssets: netWorth.totalAssets, source: 'live' }].sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth)).slice(-12); const maxAsset = Math.max(1, ...history.map((item) => item.totalAssets)); const debtRatio = netWorth.totalAssets > 0 ? netWorth.totalDebt / netWorth.totalAssets : 0;
  const assetRows = [{ label: '현금·입출금', value: netWorth.cashAssets, color: 'var(--tds-blue-500)' }, { label: '예금', value: netWorth.depositAssets, color: '#6b8afd' }, { label: '적금', value: netWorth.savingsAssets, color: 'var(--tds-green-500)' }, { label: '투자', value: netWorth.investmentAssets, color: '#8b5cf6' }, { label: '부동산·자동차', value: netWorth.nonFinancialAssets, color: '#f59e0b' }].filter((item) => item.value > 0);
  const annualDebt = new Map<number, { balance: number; principal: number; interest: number }>(); loans.filter((loan) => loan.status === 'active').forEach((loan) => { const schedule = buildAmortizationSchedule({ principal: loan.originalAmount, annualRate: loan.annualRate, termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate), graceMonths: loan.graceMonths, method: loan.repaymentMethod, firstPaymentDate: loan.firstPaymentDate }); schedule.forEach((row) => { const year = Number(row.paymentDate.slice(0, 4)); const existing = annualDebt.get(year) ?? { balance: row.remainingBalance, principal: 0, interest: 0 }; annualDebt.set(year, { balance: existing.balance + row.remainingBalance, principal: existing.principal + row.principalPayment, interest: existing.interest + row.interestPayment }); }); }); const annualDebtRows = [...annualDebt.entries()].map(([year, row]) => ({ year, ...row })).sort((a, b) => a.year - b.year);

  return <div data-page="home" className="tds-page home-page">
    <header className="home-header"><div><p className="home-eyebrow">우리집 재무</p><h1 className="tds-title">가계 재무 대시보드</h1><p className="home-subtitle">기준 월: {monthLabel(month)} · 실제로 확정된 데이터를 기준으로 보여줍니다.</p></div></header>

    <DashboardPrimaryTabs
      asset={<>
        <DashboardAssetOverview totalAssets={netWorth.totalAssets} totalDebt={netWorth.totalDebt} netWorth={netWorth.netWorth} debtRatio={debtRatio} assetRows={assetRows} history={history.map((item) => ({ month: item.snapshotMonth, value: item.totalAssets }))} maxAsset={maxAsset} liquidCash={netWorth.cashAssets} monthlyConsumption={current.consumption} realAssets={realAssets.filter((item) => item.status === 'active').map((item) => ({ id: item.id, assetName: item.assetName, currentValue: item.currentValue }))} />
      </>}
      monthly={<>
        <DashboardCashflowOverview monthly={monthlyTrend} selectedMonth={month}>
          <DashboardSpendingExplorer month={month} categories={categoryRows} payments={paymentRows} total={current.consumption} monthly={months.map((target) => summary.monthlyCategories.find((item) => item.month === target) ?? ({ month: target, total: 0, categories: [] }))} monthlyPayments={months.map((target) => paymentSummary.find((targetMonth) => targetMonth.month === target) ?? ({ month: target, total: 0, categories: [] }))} monthlyDetails={monthlyDetails.filter((item) => item.month >= months[0] && item.month <= month)} />
          <DashboardIncomeExplorer month={month} monthly={months.map((target) => incomeSummary.monthly.find((item) => item.month === target) ?? ({ month: target, total: 0, categories: [] }))} current={incomeSummary.current} />
        </DashboardCashflowOverview>


      </>}
      debt={<DashboardDebtOverview totalDebt={netWorth.totalDebt} debtRatio={debtRatio} principal={current.debtPrincipal} financeCost={current.financeCost} annual={annualDebtRows} />}
      risk={<DashboardRiskOverview insurances={insurances} />}
    />
  </div>;
}

export function RankedRows({ rows, total, empty, href }: { rows: HomeRank[]; total: number; empty: string; href?: (id: string) => string }) { const max = rows[0]?.value ?? 1; return <div className="home-ranked-list">{rows.slice(0, 6).map((row, index) => { const content = <><span className="home-rank">{index + 1}</span><div><p><span>{row.label}</span><strong>{money(row.value)}</strong></p><div><span style={{ width: `${row.value / max * 100}%` }} /></div><small>{total > 0 ? `${(row.value / total * 100).toFixed(1)}%` : '0%'}</small>{row.subcategories?.length ? <div className="mt-2 border-l-2 border-[var(--tds-grey-200)] pl-3">{row.subcategories.slice(0, 5).map((sub) => <Link key={sub.id} href={href ? `${href(row.id)}&subcategory=${sub.id}` : '#'} className="flex items-center justify-between py-1 text-xs text-[var(--tds-grey-700)] hover:text-[var(--tds-blue-600)]"><span>{sub.label}</span><b>{money(sub.value)}</b></Link>)}</div> : null}</div></>; return row.subcategories?.length ? <div key={row.id} className="home-ranked-row">{content}</div> : href ? <Link key={row.id} href={href(row.id)} className="home-ranked-row" prefetch>{content}</Link> : <div key={row.id} className="home-ranked-row">{content}</div>; })}{!rows.length && <Empty text={empty} />}</div>; }
function Empty({ text }: { text: string }) { return <p className="home-empty">{text}</p>; }
function emptyMonth(month: string): HomeMonth { return { month, income: 0, consumption: 0, fixedConsumption: 0, variableConsumption: 0, saving: 0, investment: 0, debtPrincipal: 0, financeCost: 0 }; }
function deriveMonth(value: HomeMonth) { const wealthBuilt = value.saving + value.investment + value.debtPrincipal; return { ...value, wealthBuilt, cashRemaining: value.income - value.consumption - value.financeCost - wealthBuilt }; }
