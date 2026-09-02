'use client';

import { useState, type ReactNode } from 'react';

export function DashboardPrimaryTabs({ asset, monthly, debt, risk }: { asset: ReactNode; monthly: ReactNode; debt: ReactNode; risk: ReactNode }) {
  const [tab, setTab] = useState<'asset' | 'monthly' | 'debt' | 'risk'>('monthly');
  const panels = { asset, monthly, debt, risk };
  return <section className="home-primary-tabs" aria-label="대시보드 주요 보기"><div className="home-primary-tab-list" role="tablist" aria-label="재무 정보 분류"><button type="button" role="tab" aria-selected={tab === 'asset'} className={tab === 'asset' ? 'is-selected' : ''} onClick={() => setTab('asset')}>자산</button><button type="button" role="tab" aria-selected={tab === 'monthly'} className={tab === 'monthly' ? 'is-selected' : ''} onClick={() => setTab('monthly')}>월별 상세</button><button type="button" role="tab" aria-selected={tab === 'debt'} className={tab === 'debt' ? 'is-selected' : ''} onClick={() => setTab('debt')}>부채</button><button type="button" role="tab" aria-selected={tab === 'risk'} className={tab === 'risk' ? 'is-selected' : ''} onClick={() => setTab('risk')}>리스크·혜택</button></div><div className="home-primary-panel">{panels[tab]}</div></section>;
}
