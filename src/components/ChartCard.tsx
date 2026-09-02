import { Amount } from './Amount';
import { SectionHeader } from './SectionHeader';

/* One card anatomy for every chart in the app (§8): a titled surface whose
 * body is a recharts chart.  The card owns the surface (.tds-card) and the
 * header; the caller owns the chart and any legend/note, passed as children so
 * a chart can size its own body (.tds-chart-card-body) or render an empty
 * state in the same slot. */
export function ChartCard({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode; // right side of the header — a legend, a total, a link
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`tds-card tds-chart-card ${className}`.trim()}>
      <SectionHeader title={title} description={description} action={action} />
      {children}
    </section>
  );
}

export type ChartTooltipRow = {
  label: string;
  value: number;
  type?: 'income' | 'expense' | 'neutral';
  showSign?: boolean;
  note?: string; // a non-money annotation, e.g. a share of total
};

/* Every chart shows its values on hover only (§8), and every value in this app
 * is rendered by <Amount> (§5) — including inside a chart.  `showSign` carries
 * the sign, so the magnitude is passed unsigned to avoid "--1,000원". */
export function ChartTooltip({ label, rows }: { label?: string; rows: ChartTooltipRow[] }) {
  return (
    <div className="tds-chart-tooltip">
      {label && <span className="tds-chart-tooltip-label">{label}</span>}
      {rows.map((row) => (
        <span className="tds-chart-tooltip-row" key={row.label}>
          <span>{row.label}</span>
          <span>
            <Amount
              value={row.showSign ? Math.abs(row.value) : row.value}
              type={row.type ?? 'neutral'}
              size="small"
              showSign={row.showSign}
            />
            {row.note && <span> · {row.note}</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

/* Axis labels are the one place a chart may compact a number: a full 원 amount
 * on every tick is unreadable at axis size, and the exact value is one hover
 * away in the tooltip. */
export function compactAxisValue(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude >= 100_000_000) return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억`;
  if (magnitude >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
}
