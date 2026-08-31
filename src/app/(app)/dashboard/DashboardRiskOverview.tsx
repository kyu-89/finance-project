import Link from 'next/link';
import type { Insurance } from '@/lib/insurances';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const dateLabel = (value: string) => value.replace(/-/g, '.');

export function DashboardRiskOverview({ insurances }: { insurances: Insurance[] }) {
  const active = insurances.filter((item) => item.status === 'active');
  const monthly = active.reduce((sum, item) => sum + item.monthlyPremium, 0);
  const today = new Date();
  const due = active.flatMap((item) => [item.coverageMaturityDate ? { date: item.coverageMaturityDate, label: '보장 만기', name: item.productName } : null, item.paymentMaturityDate ? { date: item.paymentMaturityDate, label: '납입 만기', name: item.productName } : null]).filter((item): item is { date: string; label: string; name: string } => Boolean(item)).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = due.filter((item) => new Date(item.date) >= today).slice(0, 5);
  return <div className="home-html-risk-view">
    <div className="home-risk-intro"><div><p className="home-eyebrow">리스크·혜택</p><h2>놓치면 손해 보는 일정을 먼저 확인해요</h2><p>보험료 부담과 만기 일정을 한곳에서 점검하고 필요한 관리를 바로 시작할 수 있습니다.</p></div><Link href="/finance/insurances" prefetch className="home-html-link">보험 관리 →</Link></div>
    <div className="home-html-kpi-grid"><Kpi label="월 보험료" value={money(monthly)} meta={`활성 계약 ${active.length}건`} /><Kpi label="다가오는 일정" value={`${upcoming.length}건`} meta="등록된 만기 일정" /><Kpi label="보장 만기" value={`${active.filter((item) => item.coverageMaturityDate).length}건`} meta="보장 종료일 등록" /><Kpi label="혜택 데이터" value="연결 전" meta="지원금 데이터 관리 필요" /></div>
    <div className="home-html-two-column"><section className="tds-card home-html-card"><div className="home-html-title"><h2>보험 계약</h2><span>{active.length}건</span></div><div className="home-risk-list">{active.slice(0, 10).map((item) => <div className="home-risk-item" key={item.id}><div><strong>{item.productName}</strong><small>{item.insurerName} · {item.insuranceType}</small></div><b>{item.monthlyPremium > 0 ? `${money(item.monthlyPremium)}/월` : '일시납·완납'}</b></div>)}</div>{!active.length && <p className="home-html-note">등록된 활성 보험이 없습니다.</p>}<Link href="/finance/insurances" prefetch className="home-html-link">보험 계약 관리 →</Link></section><section className="tds-card home-html-card"><div className="home-html-title"><h2>다가오는 만기</h2><span>날짜순</span></div><div className="home-risk-list">{upcoming.map((item) => <div className="home-risk-item" key={`${item.name}-${item.label}-${item.date}`}><div><strong>{item.label}</strong><small>{item.name}</small></div><b>{dateLabel(item.date)}</b></div>)}</div>{!upcoming.length && <p className="home-html-note">등록된 만기 일정이 없습니다. 보험 관리에서 보장·납입 만기일을 등록하면 여기에 표시됩니다.</p>}</section></div>
    <section className="tds-card home-html-card home-benefit-empty"><div className="home-html-title"><h2>정부지원금·혜택</h2><span>신청·수령 관리</span></div><p>현재 연결된 지원금 데이터가 없습니다. 거래 상세의 정부지원금 정보를 등록하면 수령 예정과 누락 여부를 확인할 수 있습니다.</p><Link href="/settings/data" prefetch className="home-html-link">혜택 데이터 관리 →</Link></section>
  </div>;
}
function Kpi({ label, value, meta }: { label: string; value: string; meta: string }) { return <article className="tds-card home-html-kpi"><span>{label}</span><strong>{value}</strong><small>{meta}</small></article>; }
