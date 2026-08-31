'use client';

import Link from 'next/link';
import { useState } from 'react';

type AssetRow = { label: string; value: number; color: string };
type HistoryRow = { month: string; value: number };
type Props = { netWorth: number; totalAssets: number; totalDebt: number; debtRatio: number; assetChange: number | null; assetRows: AssetRow[]; history: HistoryRow[]; maxAsset: number };
const money = (value: number | null) => value == null ? '-' : `${Math.round(value).toLocaleString('ko-KR')}원`;

export function DashboardNetWorthExplorer({ netWorth, totalAssets, totalDebt, debtRatio, assetChange, assetRows, history, maxAsset }: Props) {
  const [view, setView] = useState<'allocation' | 'trend' | 'debt'>('allocation');
  return <article className="home-networth-card" aria-labelledby="dashboard-networth-title">
    <div className="home-card-heading"><div><p>현재 우리 집 순자산</p><strong id="dashboard-networth-title">{money(netWorth)}</strong></div><Link href="/finance" prefetch>자산 상세 →</Link></div>
    <p className={`home-change ${assetChange != null && assetChange < 0 ? 'is-negative' : ''}`}>{assetChange == null ? '과거 자산 기록을 연결하면 변화를 비교할 수 있어요.' : `직전 기록보다 ${assetChange >= 0 ? '+' : ''}${money(assetChange)}`}</p>
    <div className="home-networth-tabs" role="tablist" aria-label="순자산 보기"><button type="button" role="tab" aria-selected={view === 'allocation'} className={view === 'allocation' ? 'is-selected' : ''} onClick={() => setView('allocation')}>자산 구성</button><button type="button" role="tab" aria-selected={view === 'trend'} className={view === 'trend' ? 'is-selected' : ''} onClick={() => setView('trend')}>순자산 추이</button><button type="button" role="tab" aria-selected={view === 'debt'} className={view === 'debt' ? 'is-selected' : ''} onClick={() => setView('debt')}>부채 현황</button></div>
    {view === 'allocation' && <><div className="home-asset-summary"><Summary label="총자산" value={totalAssets} /><Summary label="총부채" value={totalDebt} /><Summary label="부채비율" value={debtRatio} percent /></div><div className="home-allocation-bar" aria-label="자산 구성">{assetRows.map((item) => <span key={item.label} style={{ width: `${item.value / Math.max(1, totalAssets) * 100}%`, background: item.color }} />)}</div><div className="home-allocation-legend">{assetRows.map((item) => <div key={item.label}><span style={{ background: item.color }} /><p>{item.label}</p><strong>{money(item.value)}</strong></div>)}</div></>}
    {view === 'trend' && <div className="home-networth-trend"><p>월말 기록과 현재 자산을 비교합니다.</p><div className="home-asset-trend" role="img" aria-label="최근 순자산 추이">{history.map((item) => <div key={item.month}><strong>{item.month === history.at(-1)?.month ? money(item.value) : ''}</strong><span style={{ height: `${Math.max(8, item.value / maxAsset * 100)}%` }} /><small>{Number(item.month.slice(5, 7))}월</small></div>)}</div></div>}
    {view === 'debt' && <div className="home-debt-view"><div className="home-debt-primary"><span>현재 총부채</span><strong>{money(totalDebt)}</strong><small>총자산 대비 {(debtRatio * 100).toFixed(1)}%</small></div><div className="home-debt-track"><span style={{ width: `${Math.min(100, debtRatio * 100)}%` }} /></div><p>부채비율은 총자산 중 부채가 차지하는 비율입니다. 대출 상세에서 원금과 상환일정을 확인하세요.</p><Link href="/finance/loans" prefetch>대출 관리 →</Link></div>}
  </article>;
}
function Summary({ label, value, percent = false }: { label: string; value: number; percent?: boolean }) { return <div><span>{label}</span><strong>{percent ? `${(value * 100).toFixed(1)}%` : money(value)}</strong></div>; }
