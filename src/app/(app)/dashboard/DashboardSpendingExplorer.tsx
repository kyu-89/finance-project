'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HomeRank } from '@/lib/dashboard-home';

type Props = { month: string; categories: HomeRank[]; payments: HomeRank[]; total: number };

export function DashboardSpendingExplorer({ month, categories, payments, total }: Props) {
  const [dimension, setDimension] = useState<'category' | 'payment'>('category');
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = dimension === 'category' ? categories : payments;
  const max = Math.max(1, ...rows.map((row) => row.value));

  return <section className="tds-card home-spending-explorer" aria-labelledby="dashboard-spending-title">
    <div className="home-section-heading"><div><h2 id="dashboard-spending-title">이번 달 지출 분석</h2><p>확정 처리된 거래 기준이에요. 항목을 누르면 상세 내역을 볼 수 있어요.</p></div><Link href="/monthly" prefetch>거래 관리 →</Link></div>
    <div className="home-explorer-controls" aria-label="지출 분석 보기 전환"><div className="home-explorer-tabs" role="tablist" aria-label="분석 기준"><button type="button" role="tab" aria-selected={dimension === 'category'} className={dimension === 'category' ? 'is-selected' : ''} onClick={() => { setDimension('category'); setExpanded(null); }}>카테고리</button><button type="button" role="tab" aria-selected={dimension === 'payment'} className={dimension === 'payment' ? 'is-selected' : ''} onClick={() => { setDimension('payment'); setExpanded(null); }}>결제수단</button></div></div>
    <div className="home-ranked-list home-explorer-list">{rows.slice(0, 8).map((row) => { const ratio = total > 0 ? row.value / total : 0; const isExpanded = expanded === row.id; return <div key={row.id} className="home-explorer-row"><button type="button" className="home-explorer-row-trigger" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : row.id)}><span className="home-rank">{rows.indexOf(row) + 1}</span><span className="home-explorer-row-main"><span className="home-explorer-row-title"><span>{row.label}</span><strong>{Math.round(row.value).toLocaleString('ko-KR')}원 <em>{(ratio * 100).toFixed(1)}%</em></strong></span><span className="home-explorer-track"><span style={{ width: `${row.value / max * 100}%` }} /></span><small>{dimension === 'category' && row.subcategories?.length ? `하위 ${row.subcategories.length}개` : '상세 내역 보기'}</small></span><span aria-hidden="true" className="home-explorer-chevron">{isExpanded ? '⌃' : '⌄'}</span></button>{isExpanded && <div className="home-explorer-children">{row.subcategories?.length ? row.subcategories.map((sub) => <Link key={sub.id} href={`/monthly?month=${month}&category=${row.id}&subcategory=${sub.id}`} prefetch><span>{sub.label}</span><strong>{Math.round(sub.value).toLocaleString('ko-KR')}원</strong></Link>) : <Link href={dimension === 'category' ? `/monthly?month=${month}&category=${row.id}` : `/monthly?month=${month}`} prefetch>관련 거래 보기 →</Link>}</div>}</div>; })}{!rows.length && <p className="home-empty">확정된 지출 거래가 아직 없어요. 월간관리에서 거래를 입력하거나 예정 거래를 확정 처리해보세요.</p>}</div>
  </section>;
}
