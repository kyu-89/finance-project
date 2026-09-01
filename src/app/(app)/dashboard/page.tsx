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
import { DashboardDebtOverview } from './DashboardDebtOverview';
import { DashboardRiskOverview } from './DashboardRiskOverview';
import { DashboardMonthlyDetail } from './DashboardMonthlyDetail';
import { listInsurances } from '@/lib/insurances';
import { listAssets } from '@/lib/assets';
import { listLoans } from '@/lib/loans';
import { listTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { buildAmortizationSchedule, paymentMonthsInclusive } from '@/lib/loan-calculations';

const won = new Intl.NumberFormat('ko-KR');
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const money = (value: number | null | undefined) => value == null ? '-' : `${won.format(Math.round(value))}원`;
const monthLabel = (month: string) => `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;
const monthBounds = (month: string) => { const range = monthRangeFromSeoulDateString(`${month}-01`); return { from: range.fromDate, to: range.toDate }; };
const shiftMonth = (month: string, offset: number) => { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; member?: string; preset?: string; customFrom?: string; customTo?: string }> }) {
  const query = await searchParams; const today = todayInSeoul(); const currentMonth = today.slice(0, 7); const month = query.month && monthPattern.test(query.month) ? query.month : currentMonth; const trendStart = shiftMonth(month, -23); const bounds = monthBounds(month); const preset: DashboardPreset = 'month'; const dashboardRange = resolveDashboardRange(bounds.to, preset); const memberForQuery = undefined; const household = await ensureHouseholdForCurrentUser();
  const referenceDataPromise = Promise.all([
    computeCurrentNetWorth(household.id, today, memberForQuery),
    listAssetValueHistory(household.id, 36),
    listInsurances(household.id),
    listAssets(household.id),
    listLoans(household.id),
    listCategoriesWithSubcategories(household.id),
  ]);
  // The dashboard only needs planned rows for the selected month. Materializing the
  // entire 24-month chart range made every visit perform avoidable database writes.
  await materializeRecurringRulesForRange(household.id, bounds.from, bounds.to);
  const [summary, transactions, referenceData] = await Promise.all([
    getDashboardHomeSummary({ householdId: household.id, from: dashboardRange.from < `${trendStart}-01` ? dashboardRange.from : `${trendStart}-01`, to: bounds.to, monthStart: dashboardRange.from, monthEnd: dashboardRange.to, memberId: memberForQuery }),
    listTransactions({ householdId: household.id, fromDate: `${trendStart}-01`, toDate: bounds.to, reportMonthFrom: trendStart, reportMonthTo: month }),
    referenceDataPromise,
  ]);
  const [netWorth, assetHistory, insurances, realAssets, loans, categories] = referenceData;
  const incomeSubcategoryNames = new Map(categories.find((category) => category.transactionType === 'income')?.subcategories.map((subcategory) => [subcategory.id, subcategory.name]) ?? []);
  const reportMonth = (transaction: { sourceMonth?: string | null; transactionDate: string }) => transaction.sourceMonth ?? transaction.transactionDate.slice(0, 7);
  const transactionDetails = transactions.filter((transaction) => transaction.status === 'posted' && transaction.transactionType !== 'income' && (transaction.flowClass === 'consumption' || transaction.transactionType === 'refund')).map((transaction) => ({ month: reportMonth(transaction), id: transaction.categoryId ?? 'unassigned', label: '', value: transaction.amount, subcategories: [{ id: transaction.id, label: `${transaction.transactionDate} · ${transaction.description}`, value: transaction.transactionType === 'refund' ? -transaction.amount : transaction.amount }] }));
  transactionDetails.push(...transactions.filter((transaction) => transaction.status === 'posted' && transaction.transactionType === 'income').map((transaction) => ({ month: reportMonth(transaction), id: transaction.subcategoryId ?? 'income:other', label: '', value: transaction.amount, subcategories: [{ id: transaction.id, label: `${transaction.transactionDate} · ${transaction.description}`, value: transaction.amount }] })));
  const expenseCategoryNames = new Map(categories.filter((category) => category.transactionType === 'expense').map((category) => [category.id, category.name]));
  const expenseMonthlyDetail = (months: string[]) => months.map((target) => { const rows = new Map<string, { id: string; label: string; value: number; subcategories: { id: string; label: string; value: number }[] }>(); transactions.filter((transaction) => transaction.status === 'posted' && transaction.transactionType !== 'income' && (transaction.flowClass === 'consumption' || transaction.transactionType === 'refund') && reportMonth(transaction) === target).forEach((transaction) => { const id = transaction.categoryId ?? 'unassigned'; const row = rows.get(id) ?? { id, label: expenseCategoryNames.get(id) ?? '미분류', value: 0, subcategories: [] }; const value = transaction.transactionType === 'refund' ? -transaction.amount : transaction.amount; row.value += value; row.subcategories.push({ id: transaction.id, label: `${transaction.transactionDate} · ${transaction.description}`, value }); rows.set(id, row); }); return { month: target, total: [...rows.values()].reduce((sum, row) => sum + row.value, 0), categories: [...rows.values()].sort((a, b) => b.value - a.value) }; });
  const monthlyByMonth = new Map(summary.monthly.map((item) => [item.month, item])); const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11)); const incomeMonthlyDetail = months.map((target) => { const rows = new Map<string, { id: string; label: string; value: number; subcategories: { id: string; label: string; value: number }[] }>(); transactions.filter((transaction) => transaction.status === 'posted' && transaction.transactionType === 'income' && reportMonth(transaction) === target).forEach((transaction) => { const id = transaction.subcategoryId ?? 'income:other'; const row = rows.get(id) ?? { id, label: incomeSubcategoryNames.get(id) ?? '기타 수입', value: 0, subcategories: [] }; row.value += transaction.amount; row.subcategories.push({ id: transaction.id, label: `${transaction.transactionDate} · ${transaction.description}`, value: transaction.amount }); rows.set(id, row); }); return { month: target, total: [...rows.values()].reduce((sum, row) => sum + row.value, 0), categories: [...rows.values()].sort((a, b) => b.value - a.value) }; }); const incomeCurrentDetail = incomeMonthlyDetail.find((item) => item.month === month)?.categories ?? []; const monthlyExpenseDetail = expenseMonthlyDetail(months); const monthlyTrend = months.map((target) => deriveMonth(monthlyByMonth.get(target) ?? emptyMonth(target))); const monthCurrent = deriveMonth(monthlyByMonth.get(month) ?? emptyMonth(month)); const current = monthCurrent; const categoryRows = summary.categories; const paymentRows = summary.payments;
  const history = [...assetHistory.filter((item) => item.snapshotMonth.slice(0, 7) !== currentMonth), { id: 'current', snapshotMonth: `${currentMonth}-01`, totalAssets: netWorth.totalAssets, source: 'live' }].sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth)).slice(-12); const debtRatio = netWorth.totalAssets > 0 ? netWorth.totalDebt / netWorth.totalAssets : 0;
  const assetRows = [{ label: '현금·입출금', value: netWorth.cashAssets, color: 'var(--tds-blue-500)' }, { label: '예금', value: netWorth.depositAssets, color: '#6b8afd' }, { label: '적금', value: netWorth.savingsAssets, color: 'var(--tds-green-500)' }, { label: '투자', value: netWorth.investmentAssets, color: '#8b5cf6' }, { label: '부동산·자동차', value: netWorth.nonFinancialAssets, color: '#f59e0b' }].filter((item) => item.value > 0);
  const annualDebt = new Map<number, { balance: number; principal: number; interest: number }>(); loans.filter((loan) => loan.status === 'active').forEach((loan) => { const schedule = buildAmortizationSchedule({ principal: loan.originalAmount, annualRate: loan.annualRate, termMonths: paymentMonthsInclusive(loan.firstPaymentDate, loan.maturityDate), graceMonths: loan.graceMonths, method: loan.repaymentMethod, firstPaymentDate: loan.firstPaymentDate }); schedule.forEach((row) => { const year = Number(row.paymentDate.slice(0, 4)); const existing = annualDebt.get(year) ?? { balance: row.remainingBalance, principal: 0, interest: 0 }; annualDebt.set(year, { balance: existing.balance + row.remainingBalance, principal: existing.principal + row.principalPayment, interest: existing.interest + row.interestPayment }); }); }); const annualDebtRows = [...annualDebt.entries()].map(([year, row]) => ({ year, ...row })).sort((a, b) => a.year - b.year);

  return <div data-page="home" className="tds-page home-page">
    <header className="home-header"><div><p className="home-eyebrow">우리집 재무</p><h1 className="tds-title">가계 재무 대시보드</h1><p className="home-subtitle">기준 월: {monthLabel(month)} · 실제로 확정된 데이터를 기준으로 보여줍니다.</p></div></header>
    {(summary.reviewCount > 0 || summary.plannedCount > 0) && <aside className="dashboard-alert-strip" aria-label="확인할 알림"><span aria-hidden="true">●</span><div><strong>확인할 일이 있어요</strong><p>{summary.reviewCount > 0 ? `검토가 필요한 거래 ${summary.reviewCount}건` : ''}{summary.reviewCount > 0 && summary.plannedCount > 0 ? ' · ' : ''}{summary.plannedCount > 0 ? `예정 거래 ${summary.plannedCount}건` : ''}</p></div><Link href="/monthly" prefetch>월간관리에서 확인</Link></aside>}

    <DashboardPrimaryTabs
      asset={<>
        <DashboardAssetOverview totalAssets={netWorth.totalAssets} totalDebt={netWorth.totalDebt} netWorth={netWorth.netWorth} debtRatio={debtRatio} assetRows={assetRows} history={history.map((item) => ({ month: item.snapshotMonth, value: item.totalAssets }))} liquidCash={netWorth.cashAssets} monthlyConsumption={current.consumption} realAssets={realAssets.filter((item) => item.status === 'active').map((item) => ({ id: item.id, assetName: item.assetName, currentValue: item.currentValue }))} />
      </>}
      monthly={<>
        <DashboardCashflowOverview monthly={monthlyTrend} selectedMonth={month}>
          <DashboardMonthlyDetail selectedMonth={month} monthly={monthlyTrend} incomeMonthly={incomeMonthlyDetail} incomeCurrent={incomeCurrentDetail} expenseMonthly={monthlyExpenseDetail} expenseCurrent={categoryRows} expensePayments={paymentRows} transactionDetails={transactionDetails} />
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
