import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { todayInSeoul } from '@/lib/date';
import { getDashboardHomeSummary, type HomeRecent } from '@/lib/dashboard-home';
import { computeCurrentNetWorth } from '@/lib/snapshots';
import { materializeRecurringRulesForRange } from '@/lib/recurring-rules';
import { listTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { generateInsights, periodTotals, reportMonthOf } from '@/lib/analysis';
import { AnalysisCashflowChart } from '../analysis/AnalysisCashflowChart';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number | null | undefined) => value == null ? '-' : `${won.format(Math.round(value))}원`;
const monthLabel = (month: string) => `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;
const shiftMonth = (month: string, offset: number) => { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

// 2026-09: 대시보드/분석/월간관리 정보구조 재정리(사용자 지시) — 대시보드는 더 이상 상세 분석
// 화면이 아니라 "지금 우리 집 재무 상태를 판단하고 행동하는" 화면이다. 연간 전체 목록·카테고리
// 드릴다운·카드별 상세처럼 긴 분석은 전부 /analysis로 옮기고, 여기는 §3이 정한 8단계 순서
// (알림 → 총자산/총부채/순자산 → 이번 달 수입/총지출/저축성지출/순현금흐름 → 예정 거래 →
// 핵심 인사이트 → 최근 추이 미리보기 → 최근 거래 → 분석 이동 CTA)만 보여준다.
export default async function DashboardPage() {
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const currentMonth = today.slice(0, 7);
  // 이번 달은 대개 아직 안 끝나서 데이터가 비어 보이므로, 요약은 전월을 기본으로 보여준다
  // (기존 dashboard/DashboardMonthlyDetail이 쓰던 것과 같은 원칙).
  const month = shiftMonth(currentMonth, -1);
  const previousMonth = shiftMonth(month, -1);
  const trailingStart = shiftMonth(month, -5); // 최근 6개월 미리보기 + 인사이트용 3개월 평균 계산 범위
  const monthStart = `${month}-01`;
  const monthEndDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

  await materializeRecurringRulesForRange(household.id, monthStart, monthEndDate);

  const [summary, categories, netWorth, transactions] = await Promise.all([
    getDashboardHomeSummary({ householdId: household.id, from: monthStart, to: monthEndDate, monthStart, monthEnd: monthEndDate }),
    listCategoriesWithSubcategories(household.id),
    computeCurrentNetWorth(household.id, today),
    listTransactions({ householdId: household.id, fromDate: `${trailingStart}-01`, toDate: monthEndDate, reportMonthFrom: trailingStart, reportMonthTo: month }),
  ]);

  const categoryNames = new Map(categories.filter((c) => c.transactionType === 'expense').map((c) => [c.id, c.name]));
  const incomeSubcategoryNames = new Map(categories.find((c) => c.transactionType === 'income')?.subcategories.map((s) => [s.id, s.name]) ?? []);
  const savingsCategoryId = categories.find((c) => c.name === '저축성지출')?.id ?? null;

  const currentMonthTransactions = transactions.filter((t) => reportMonthOf(t) === month);
  const previousMonthTransactions = transactions.filter((t) => reportMonthOf(t) === previousMonth);
  const trailing3MonthsTransactions = transactions.filter((t) => { const m = reportMonthOf(t); return m >= shiftMonth(month, -3) && m < month; });
  const totals = periodTotals(currentMonthTransactions, savingsCategoryId);
  const plannedRows = transactions.filter((t) => t.status === 'planned' && reportMonthOf(t) === month);
  const plannedAmount = plannedRows.reduce((sum, t) => sum + t.amount, 0);

  const insights = generateInsights({ currentMonth: currentMonthTransactions, previousMonth: previousMonthTransactions, trailing3Months: trailing3MonthsTransactions, categoryNames, incomeSubcategoryNames });

  const sixMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const trendMonthly = sixMonths.map((m) => { const t = periodTotals(transactions.filter((row) => reportMonthOf(row) === m), savingsCategoryId); return { month: m, income: t.income, expense: t.expense, savings: t.savings, net: t.net }; });

  const recent: HomeRecent[] = [...currentMonthTransactions].filter((t) => t.status === 'posted').sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).slice(0, 5).map((t) => ({ id: t.id, transactionDate: t.transactionDate, transactionType: t.transactionType, flowClass: t.flowClass, amount: t.amount, description: t.description }));

  return <div data-page="home" className="tds-page home-page">
    <header className="tds-page-header"><div><p className="tds-eyebrow">우리집 가계부</p><h1 className="tds-title">우리 집 재무 현황</h1><p className="tds-page-subtitle">우리 집의 자산과 이번 달 돈의 흐름을 한눈에 확인해요.</p></div></header>

    {/* 1. 확인이 필요한 알림 */}
    {(summary.reviewCount > 0 || plannedRows.length > 0) && <aside className="dashboard-alert-strip" aria-label="확인할 알림"><span aria-hidden="true">●</span><div><strong>확인할 일이 있어요</strong><p>{summary.reviewCount > 0 ? `검토가 필요한 거래 ${summary.reviewCount}건` : ''}{summary.reviewCount > 0 && plannedRows.length > 0 ? ' · ' : ''}{plannedRows.length > 0 ? `예정 거래 ${plannedRows.length}건 · ${money(plannedAmount)}` : ''}</p></div><Link href="/monthly" prefetch className="tds-text-link">월간관리에서 확인</Link></aside>}
    {summary.referenceCount > 0 && <aside className="dashboard-alert-strip is-neutral" aria-label="참고 거래 요약"><span aria-hidden="true">●</span><div><strong>참고 거래 {summary.referenceCount}건 · 카드 사용액 {money(summary.referenceCardAmount)}</strong><p>수입·지출·순현금흐름에는 포함되지 않은 금액이에요.</p></div><Link href="/analysis?type=reference" prefetch className="tds-text-link">분석에서 확인</Link></aside>}

    {/* 2. 총자산·총부채·순자산 */}
    <section className="tds-summary-grid" aria-label="자산 현황">
      <StatCard label="총자산" value={<Amount value={netWorth.totalAssets} size="large" />} meta={<Link href="/finance" prefetch className="tds-text-link">자산·금융에서 보기</Link>} />
      <StatCard label="총부채" value={<Amount value={netWorth.totalDebt} size="large" />} meta={netWorth.totalAssets > 0 ? `총자산 대비 ${(netWorth.totalDebt / netWorth.totalAssets * 100).toFixed(1)}%` : '-'} />
      <StatCard label="순자산" value={<Amount value={netWorth.netWorth} size="large" />} meta="총자산 − 총부채" />
    </section>

    {/* 3. 이번 달 수입·총지출·저축성지출·순현금흐름 */}
    <section className="tds-summary-grid" aria-label="이번 달 요약">
      <StatCard label={`${monthLabel(month)} 수입`} value={<Amount value={totals.income} type="income" size="large" />} meta="확정 수입 합계" />
      <StatCard label="총지출" value={<Amount value={totals.expense} type="expense" size="large" />} meta="저축성지출 포함" />
      <StatCard label="저축성 지출" value={<Amount value={totals.savings} type="expense" size="large" />} meta="총지출에 포함된 금액" />
      <StatCard label="순현금흐름" value={<Amount value={Math.abs(totals.net)} type={totals.net >= 0 ? 'income' : 'expense'} size="large" showSign />} meta={totals.income > 0 ? `수입의 ${(totals.net / totals.income * 100).toFixed(1)}%` : '수입 − 지출'} />
    </section>

    {/* 4. 처리할 예정 거래 */}
    <section className="tds-card tds-section-card" aria-label="예정 거래">
      <SectionHeader title="예정 거래" description="정기거래에서 만들어졌지만 아직 확정하지 않은 거래입니다." />
      <div className="tds-section-card-list">
        {plannedRows.length > 0
          ? <ListItem title={`확정을 기다리는 거래 ${plannedRows.length}건 · ${money(plannedAmount)}`} description="월간관리에서 확정하거나 이번 달 제외로 처리할 수 있어요." trailing={<Link href="/monthly" prefetch className="tds-button-secondary">월간관리로 이동</Link>} />
          : <EmptyState title="예정 거래가 없어요" description="이번 달 정기거래가 모두 처리되었습니다." />}
      </div>
    </section>

    {/* 5. 핵심 인사이트 — 근거 있는 문장만 표시(§3) */}
    {insights.length > 0 && <section className="tds-card tds-section-card" aria-label="핵심 인사이트">
      <SectionHeader title="핵심 인사이트" description="확정된 거래를 기준으로 계산했어요." />
      <ul className="tds-section-card-list">{insights.map((text) => <li key={text} className="dashboard-insight-row">{text}</li>)}</ul>
    </section>}

    {/* 6. 최근 6개월 추이 미리보기 */}
    <AnalysisCashflowChart scope="year" monthly={trendMonthly} daily={[]} title="최근 6개월 추이" description="확정 거래 기준 · 자세히 보려면 분석 메뉴로 이동하세요" />

    {/* 7. 최근 거래 */}
    <section className="tds-card tds-section-card" aria-label="최근 거래">
      <SectionHeader title="최근 거래" description="가장 최근에 기록된 거래입니다." action={<Link href="/monthly" prefetch className="tds-text-link">전체 보기</Link>} />
      <div className="tds-section-card-list">
        {recent.length
          ? recent.map((row) => <ListItem key={row.id} title={row.description || '내용 없음'} metadata={row.transactionDate} trailing={<Amount value={row.amount} type={row.transactionType === 'income' ? 'income' : row.transactionType === 'reference' ? 'neutral' : 'expense'} size="small" showSign />} />)
          : <EmptyState title="최근 거래가 없어요" description="거래를 기록하면 이곳에 최근 순으로 보여드립니다." />}
      </div>
    </section>

    {/* 8. 분석 화면 이동 CTA */}
    <Link href="/analysis" prefetch className="dashboard-analysis-cta">수입·지출 자세히 분석하기 →</Link>
  </div>;
}
