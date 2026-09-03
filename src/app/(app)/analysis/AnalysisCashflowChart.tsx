'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, ChartTooltip, compactAxisValue } from '@/components/ChartCard';
import { EmptyState } from '@/components/EmptyState';
import type { DayPoint, MonthPoint } from '@/lib/analysis';

// §11-1 — 월별(연간)/일별(월간) 현금흐름. 저축성지출은 총지출에 이미 포함된 금액이라 "보조
// 시리즈"로 얇게 그려서 이중 합산처럼 보이지 않게 한다(사용자 지시) — 범례와 차트 하단 문구로도
// 명시한다.
type Row = { key: string; label: string; income: number; expense: number; savings: number; net: number };

function CashflowTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Row }> }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <ChartTooltip label={row.label} rows={[
    { label: '수입', value: row.income, type: 'income' },
    { label: '총지출', value: row.expense, type: 'expense' },
    { label: '(포함) 저축성지출', value: row.savings, type: 'neutral' },
    { label: '순현금흐름', value: row.net, type: row.net >= 0 ? 'income' : 'expense', showSign: true },
  ]} />;
}

export function AnalysisCashflowChart({ scope, monthly, daily, title, description }: { scope: 'year' | 'month'; monthly: MonthPoint[]; daily: DayPoint[]; title?: string; description?: string }) {
  const rows: Row[] = scope === 'year'
    ? monthly.map((m) => ({ key: m.month, label: `${Number(m.month.slice(5, 7))}월`, income: m.income, expense: m.expense, savings: m.savings, net: m.net }))
    : daily.map((d) => ({ key: d.date, label: `${Number(d.date.slice(8, 10))}일`, income: d.income, expense: d.expense, savings: d.savings, net: d.income - d.expense }));
  const hasData = rows.some((r) => r.income > 0 || r.expense > 0);
  return <ChartCard
    title={title ?? (scope === 'year' ? '월별 현금흐름' : '일별 현금흐름')}
    description={description ?? (scope === 'year' ? '이 해 12개월 · 확정 거래 기준' : '이 달의 일별 확정 거래 기준')}
    action={<span className="tds-chart-legend"><span><i className="is-income" />수입</span><span><i className="is-expense" />총지출</span></span>}
  >
    {hasData ? <>
      <div className="tds-chart-card-body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={4} />
            <YAxis width={52} tickCount={4} tickLine={false} axisLine={false} tickFormatter={compactAxisValue} />
            <Tooltip content={<CashflowTooltip />} />
            <Line className="tds-chart-series-income" type="monotone" dataKey="income" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
            <Line className="tds-chart-series-expense" type="monotone" dataKey="expense" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
            <Line dataKey="savings" stroke="var(--tds-grey-400)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="tds-chart-note">점선(저축성지출)은 총지출에 이미 포함된 금액이에요 · 순현금흐름은 마우스를 올리면 확인할 수 있어요.</p>
    </> : <EmptyState title="표시할 데이터가 없어요" description="확정된 거래가 기록되면 추이를 보여드립니다." />}
  </ChartCard>;
}
