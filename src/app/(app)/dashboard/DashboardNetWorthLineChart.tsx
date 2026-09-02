'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, compactAxisValue } from '@/components/ChartCard';

/* §7 item 7 / §8 — the asset trend, same data and props as the hand-drawn SVG
 * this replaces (rows = month + value, optional target line), now a single
 * recharts line in the asset color. */

type Row = { month: string; label: string; value: number };

function NetWorthTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Row }> }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <ChartTooltip
      label={`${row.month.slice(0, 4)}년 ${Number(row.month.slice(5, 7))}월`}
      rows={[{ label: '자산', value: row.value, type: 'neutral' }]}
    />
  );
}

export function DashboardNetWorthLineChart({ rows, target }: { rows: Array<{ month: string; value: number }>; target?: number }) {
  const data: Row[] = rows.map((row) => ({ month: row.month, label: `${Number(row.month.slice(5, 7))}월`, value: row.value }));

  return (
    <div className="tds-chart-card-body">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={4} />
          <YAxis width={52} tickCount={4} tickLine={false} axisLine={false} tickFormatter={compactAxisValue} />
          <Tooltip content={<NetWorthTooltip />} />
          {target != null && <ReferenceLine className="tds-chart-target" y={target} ifOverflow="extendDomain" />}
          <Line className="tds-chart-series-asset" type="monotone" dataKey="value" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
