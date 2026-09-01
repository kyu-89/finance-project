import type { ReactNode } from 'react';
import type { HomeMonth } from '@/lib/dashboard-home';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const outflow = (item: HomeMonth) => item.consumption + item.financeCost + item.saving + item.investment + item.debtPrincipal;

export function DashboardCashflowOverview({ monthly, selectedMonth, children }: { monthly: HomeMonth[]; selectedMonth: string; children: ReactNode }) {
  const max = Math.max(1, ...monthly.flatMap((item) => [item.income, item.consumption]));

  return <div className="home-html-flow-view">
    <section className="tds-card home-html-card">
      <div className="home-html-title"><h2>월별 수입 · 소비 추이</h2><span>확정 거래 기준</span></div>
      <div className="home-cashflow-chart">{monthly.map((item) => <div className={item.month === selectedMonth ? 'is-current' : ''} key={item.month}><div className="home-cashflow-bars"><i title={`${item.month} 수입 ${money(item.income)}`} aria-label={`${item.month} 수입 ${money(item.income)}`} style={{ height: `${item.income / max * 100}%` }} /><i title={`${item.month} 소비성 지출 ${money(item.consumption)}`} aria-label={`${item.month} 소비성 지출 ${money(item.consumption)}`} style={{ height: `${item.consumption / max * 100}%` }} /></div><small>{item.month.slice(5, 7)}월</small></div>)}</div>
      <div className="home-html-legend"><span><i className="is-blue" />수입</span><span><i className="is-red" />소비성 지출</span></div>
      <p className="home-html-note">선택한 월의 예정 거래는 확정 금액에 포함하지 않습니다.</p>
    </section>
    <section className="tds-card home-html-card">
      <div className="home-html-title"><h2>순현금흐름</h2><span>수입 − 총지출</span></div>
      <div className="home-cashflow-values">{monthly.slice(-6).map((item) => <div className={item.month === selectedMonth ? 'is-current' : ''} key={item.month}><span>{item.month.slice(5, 7)}월</span><b title={`${item.month} 순현금흐름 ${money(item.income - outflow(item))}`} className={outflow(item) <= item.income ? 'is-positive' : 'is-negative'}>{money(item.income - outflow(item))}</b></div>)}</div>
      <p className="home-html-note">흑수면 해당 월에 돈이 쌓이고, 적수면 보유 자산에서 부족분을 사용한 것입니다.</p>
    </section>
    <div className="home-html-flow-detail">{children}</div>
  </div>;
}
