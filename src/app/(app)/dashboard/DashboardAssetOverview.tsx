'use client';

import Link from 'next/link';
import { DashboardNetWorthLineChart } from './DashboardNetWorthLineChart';
import { Amount } from '@/components/Amount';
import { ChartCard } from '@/components/ChartCard';
import type { ReactNode } from 'react';

type AssetRow = { label: string; value: number; color: string };
type HistoryRow = { month: string; value: number };
const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

export function DashboardAssetOverview({ totalAssets, totalDebt, netWorth, debtRatio, assetRows, history, liquidCash, monthlyConsumption, realAssets }: { totalAssets: number; totalDebt: number; netWorth: number; debtRatio: number; assetRows: AssetRow[]; history: HistoryRow[]; liquidCash: number; monthlyConsumption: number; realAssets: Array<{ id: string; assetName: string; currentValue: number }> }) {
  const nonFinancial = assetRows.find((row) => row.label === '부동산·자동차')?.value ?? 0;
  const financial = Math.max(0, totalAssets - nonFinancial);
  const groups = [{ label: '금융자산', value: financial, color: 'var(--tds-blue-500)' }, { label: '부동자산', value: nonFinancial, color: 'var(--tds-orange-500, #f59e0b)' }];
  const emergencyMonths = monthlyConsumption > 0 ? liquidCash / monthlyConsumption : null;
  return <div className="home-html-asset-view">
    <div className="home-html-kpi-grid"><HtmlKpi label="총자산" value={money(totalAssets)} meta={<MetaStack items={[`금융 ${money(financial)}`, `부동 ${money(nonFinancial)}`]} />} /><HtmlKpi label="순자산" value={money(netWorth)} meta={<MetaStack items={[`총자산 ${money(totalAssets)}`, `부채 ${money(totalDebt)}`]} />} accent /><HtmlKpi label="부채" value={money(totalDebt)} meta={`총자산 대비 ${(debtRatio * 100).toFixed(1)}%`} /><HtmlKpi label="비상금" value={emergencyMonths == null ? '-' : `${emergencyMonths.toFixed(1)}개월`} meta={<MetaStack items={[`유동 ${money(liquidCash)}`, `월소비 ${money(monthlyConsumption)}`]} />} /></div>
    <ChartCard title="순자산 변동 추이" description="월말 기록 기준 · 최근 12개월" action={<Amount value={history.at(-1)?.value ?? 0} size="small" />}><DashboardNetWorthLineChart rows={history} /></ChartCard>
    <section className="tds-card home-html-card"><SectionTitle title="자산 구성" /><div className="home-html-stack">{groups.map((group) => <span key={group.label} style={{ width: `${totalAssets > 0 ? group.value / totalAssets * 100 : 0}%`, background: group.color }} />)}</div><div className="home-html-legend">{groups.map((group) => <span key={group.label}><i style={{ background: group.color }} />{group.label} · {money(group.value)}</span>)}</div><div className="home-html-equation"><b>총자산<br />{money(totalAssets)}</b><strong>−</strong><b>부채<br />{money(totalDebt)}</b><strong>=</strong><b className="is-accent">순자산<br />{money(netWorth)}</b></div></section>
    <div className="home-html-two-column"><section className="tds-card home-html-card"><SectionTitle title="금융자산 상세" meta="유형별" /><div className="home-html-bars">{assetRows.filter((row) => row.label !== '부동산·자동차').map((row) => <div key={row.label}><span>{row.label}</span><b>{money(row.value)}</b><i><em style={{ width: `${financial > 0 ? row.value / financial * 100 : 0}%` }} /></i></div>)}</div><p className="home-html-note">계좌·예금·적금·투자 등 현재 금융자산을 유형별로 보여줍니다.</p></section><section className="tds-card home-html-card"><SectionTitle title="부동자산 상세" /><div className="home-html-bars">{realAssets.map((row) => <div key={row.id}><span>{row.assetName}</span><b>{money(row.currentValue)}</b><i><em style={{ width: `${nonFinancial > 0 ? row.currentValue / nonFinancial * 100 : 0}%` }} /></i></div>)}</div>{!realAssets.length && <p className="home-html-note">등록된 부동자산이 없습니다.</p>}<p className="home-html-note">시세 변동·매매 전에는 등록한 평가액을 기준으로 합니다.</p><Link href="/finance/assets" prefetch className="home-html-link tds-text-link">자산 관리 →</Link></section></div>
    <section className="tds-card home-html-card"><SectionTitle title="자산 성격별 분류" meta="참고용" /><div className="home-html-note">위험자산은 투자, 원금보장형은 현금·예금·적금, 연금은 장기자산으로 분류합니다.</div><Link href="/finance" prefetch className="home-html-link tds-text-link">금융자산 관리 →</Link></section>
  </div>;
}
function HtmlKpi({ label, value, meta, accent = false }: { label: string; value: string; meta: ReactNode; accent?: boolean }) { return <article className="tds-card home-html-kpi"><span>{label}</span><strong className={accent ? 'is-accent' : ''}>{value}</strong><small className={typeof meta === 'object' ? 'home-html-kpi-meta-stack' : undefined}>{meta}</small></article>; }
function MetaStack({ items }: { items: string[] }) { return <span className="home-html-kpi-meta-stack">{items.map((item) => <span key={item}>{item}</span>)}</span>; }
function SectionTitle({ title, meta }: { title: string; meta?: string }) { return <div className="home-html-title"><h2>{title}</h2>{meta && <span>{meta}</span>}</div>; }
