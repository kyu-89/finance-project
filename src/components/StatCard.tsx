export function StatCard({
  label,
  value,
  meta,
  tone = 'neutral',
  className = '',
}: {
  label: string;
  value: React.ReactNode; // usually an <Amount>, but callers may pass plain text/JSX for non-money stats
  meta?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
  className?: string;
}) {
  return (
    <article className={`tds-card tds-stat-card ${className}`.trim()}>
      <span className="tds-stat-card-label">{label}</span>
      <div className={`tds-stat-card-value tds-stat-card-value-${tone}`}>{value}</div>
      {meta && <small className="tds-stat-card-meta">{meta}</small>}
    </article>
  );
}
