'use client';

import type { HomeMonth } from '@/lib/dashboard-home';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

function totalOutflow(item: HomeMonth) {
  return item.consumption + item.financeCost + item.saving + item.investment + item.debtPrincipal;
}

function FlowChart({ values, colors, format = money }: { values: number[][]; colors: string[]; format?: (value: number) => string }) {
  const max = Math.max(1, ...values.flat().map((value) => Math.abs(value)));
  return <div className="home-flow-trend-chart" role="img" aria-label="월별 추이 차트">
    {values[0].map((_, index) => <div className="home-flow-trend-column" key={index}>
      <span className="home-flow-trend-value">{format(values[0][index])}</span>
      <div className="home-flow-trend-track">{values.map((series, seriesIndex) => <span key={seriesIndex} style={{ height: `${Math.max(series[index] === 0 ? 0 : 6, Math.abs(series[index]) / max * 100)}%`, background: colors[seriesIndex] }} />)}</div>
    </div>)}
  </div>;
}

export function DashboardFlowTrends({ monthly, selectedMonth }: { monthly: HomeMonth[]; selectedMonth: string }) {
  const income = monthly.map((item) => item.income);
  const consumption = monthly.map((item) => item.consumption + item.financeCost);
  const savingsRate = monthly.map((item) => item.income > 0 ? (item.saving + item.investment) / item.income * 100 : 0);
  const cashflow = monthly.map((item) => item.income - totalOutflow(item));
  const monthLabels = monthly.map((item) => Number(item.month.slice(5, 7)));
  const latest = monthly.at(-1);
  return <section className="home-section home-flow-trends" aria-labelledby="home-flow-trends-title">
    <div className="home-section-heading"><div><h2 id="home-flow-trends-title">월별 흐름과 비율</h2><p>수입과 소비, 저축률, 순현금흐름을 같은 기간으로 비교합니다.</p></div><span className="home-trend-period">최근 {monthly.length}개월</span></div>
    <div className="home-flow-trend-grid">
      <article className="tds-card home-flow-trend-card"><h3>수입·소비 추이</h3><div className="home-flow-trend-legend"><span className="is-income">수입</span><span className="is-expense">소비·금융비용</span></div><FlowChart values={[income, consumption]} colors={["var(--tds-blue-500)", "var(--tds-red-500)"]} /><div className="home-flow-trend-labels">{monthLabels.map((label, index) => <span className={monthly[index]?.month === selectedMonth ? 'is-current' : ''} key={`${label}-${index}`}>{label}월</span>)}</div></article>
      <article className="tds-card home-flow-trend-card"><h3>저축률 추이</h3><p className="home-flow-trend-callout">{latest && latest.income > 0 ? `${(savingsRate.at(-1) ?? 0).toFixed(1)}%` : '-'}</p><FlowChart values={[savingsRate]} colors={["var(--tds-green-500)"]} format={(value) => `${value.toFixed(0)}%`} /><div className="home-flow-trend-labels">{monthLabels.map((label, index) => <span className={monthly[index]?.month === selectedMonth ? 'is-current' : ''} key={`${label}-${index}`}>{label}월</span>)}</div></article>
      <article className="tds-card home-flow-trend-card"><h3>순현금흐름</h3><p className={`home-flow-trend-callout ${(cashflow.at(-1) ?? 0) < 0 ? 'is-negative' : ''}`}>{cashflow.at(-1) == null ? '-' : money(cashflow.at(-1) ?? 0)}</p><FlowChart values={[cashflow]} colors={["var(--tds-purple-500, #8b5cf6)"]} /><div className="home-flow-trend-labels">{monthLabels.map((label, index) => <span className={monthly[index]?.month === selectedMonth ? 'is-current' : ''} key={`${label}-${index}`}>{label}월</span>)}</div></article>
    </div>
  </section>;
}
