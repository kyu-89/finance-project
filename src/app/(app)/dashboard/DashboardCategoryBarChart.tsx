'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HomeRank } from '@/lib/dashboard-home';
import { ChartCard, ChartTooltip, compactAxisValue } from '@/components/ChartCard';
import { EmptyState } from '@/components/EmptyState';

/* §7 item 4 — 카테고리별 지출, as a horizontal BarChart in one expense color
 * (§8: one color per chart, minimal axis text).  This is the summary-level
 * ranking only; the drill-down with subcategory links stays in
 * DashboardMonthlyDetail. */

type Row = { id: string; label: string; value: number; share: number };
const TOP_COUNT = 6;

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: Row }> }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <ChartTooltip
      label={row.label}
      rows={[{ label: '지출', value: row.value, type: 'expense', note: `${(row.share * 100).toFixed(1)}%` }]}
    />
  );
}

export function DashboardCategoryBarChart({ rows }: { rows: HomeRank[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const data: Row[] = rows
    .slice(0, TOP_COUNT)
    .map((row) => ({ id: row.id, label: row.label, value: row.value, share: total > 0 ? row.value / total : 0 }));

  return (
    <ChartCard
      title="카테고리별 지출"
      description={`이번 달 소비성 지출 상위 ${TOP_COUNT}개 카테고리입니다.`}
    >
      {data.length ? (
        <div className="tds-chart-card-body">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickCount={4} tickLine={false} axisLine={false} tickFormatter={compactAxisValue} />
              <YAxis type="category" dataKey="label" width={88} tickLine={false} axisLine={false} />
              <Tooltip content={<CategoryTooltip />} />
              <Bar className="tds-chart-series-expense-bar" dataKey="value" maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState title="이번 달 지출이 없어요" description="확정된 소비성 지출이 기록되면 카테고리별로 보여드립니다." />
      )}
    </ChartCard>
  );
}
