'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, ChartTooltip, compactAxisValue } from '@/components/ChartCard';
import { EmptyState } from '@/components/EmptyState';
import type { AnalysisRow } from '@/lib/analysis';

// §11-2/§11-3 — 수입 구성/지출 구성 가로 막대. 항목이 많을 수 있어 파이 대신 가로 막대를 쓴다
// (사용자 지시: "항목이 많으면 파이 차트 대신 가로 막대 사용"). 소분류가 아주 많아지지 않도록
// 상위 N개만 그리고 나머지는 드릴다운 목록에서 전부 확인한다.
type Row = { id: string; label: string; value: number; share: number };
const TOP_COUNT = 8;

function BarTooltip({ active, payload, tone }: { active?: boolean; payload?: Array<{ payload?: Row }>; tone: 'income' | 'expense' }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <ChartTooltip label={row.label} rows={[{ label: tone === 'income' ? '수입' : '지출', value: row.value, type: tone, note: `${(row.share * 100).toFixed(1)}%` }]} />;
}

export function AnalysisBarChart({ title, description, rows, tone }: { title: string; description: string; rows: AnalysisRow[]; tone: 'income' | 'expense' }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const data: Row[] = rows.slice(0, TOP_COUNT).map((row) => ({ id: row.id, label: row.label, value: row.value, share: total > 0 ? row.value / total : 0 }));
  return <ChartCard title={title} description={description}>
    {data.length ? <div className="tds-chart-card-body">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickCount={4} tickLine={false} axisLine={false} tickFormatter={compactAxisValue} />
          <YAxis type="category" dataKey="label" width={92} tickLine={false} axisLine={false} />
          <Tooltip content={<BarTooltip tone={tone} />} />
          <Bar className={tone === 'income' ? 'tds-chart-series-income-bar' : 'tds-chart-series-expense-bar'} dataKey="value" maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div> : <EmptyState title="표시할 데이터가 없어요" description="거래가 기록되면 항목별로 보여드립니다." />}
  </ChartCard>;
}
