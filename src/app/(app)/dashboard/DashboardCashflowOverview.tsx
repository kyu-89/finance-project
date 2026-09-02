'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HomeMonth } from '@/lib/dashboard-home';
import { ChartCard, ChartTooltip, compactAxisValue } from '@/components/ChartCard';

/* §7 item 3 — 수입 vs 지출 추이.  Replaces the hand-computed CSS bar pairs with
 * a recharts LineChart: one stroke per series, two semantic colors, no grid
 * beyond the horizontal scale, values on hover only. */

type Row = { month: string; label: string; income: number; consumption: number; net: number };

const outflow = (item: HomeMonth) => item.consumption + item.financeCost + item.saving + item.investment + item.debtPrincipal;

function CashflowTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Row }> }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <ChartTooltip
      label={`${row.month.slice(0, 4)}년 ${Number(row.month.slice(5, 7))}월`}
      rows={[
        { label: '수입', value: row.income, type: 'income' },
        { label: '소비성 지출', value: row.consumption, type: 'expense' },
        { label: '순현금흐름', value: row.net, type: row.net >= 0 ? 'income' : 'expense', showSign: true },
      ]}
    />
  );
}

export function DashboardCashflowOverview({ monthly }: { monthly: HomeMonth[] }) {
  const rows: Row[] = monthly.map((item) => ({
    month: item.month,
    label: `${Number(item.month.slice(5, 7))}월`,
    income: item.income,
    consumption: item.consumption,
    net: item.income - outflow(item),
  }));

  return (
    <ChartCard
      title="수입 vs 지출 추이"
      description="최근 12개월 · 확정 거래 기준. 예정 거래는 포함하지 않습니다."
      action={
        <span className="tds-chart-legend">
          <span><i className="is-income" />수입</span>
          <span><i className="is-expense" />소비성 지출</span>
        </span>
      }
    >
      <div className="tds-chart-card-body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={4} />
            <YAxis width={52} tickCount={4} tickLine={false} axisLine={false} tickFormatter={compactAxisValue} />
            <Tooltip content={<CashflowTooltip />} />
            <Line className="tds-chart-series-income" type="monotone" dataKey="income" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
            <Line className="tds-chart-series-expense" type="monotone" dataKey="consumption" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="tds-chart-note">순현금흐름(수입 − 총지출)은 각 월에 마우스를 올리면 확인할 수 있어요.</p>
    </ChartCard>
  );
}
