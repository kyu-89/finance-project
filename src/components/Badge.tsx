export function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'neutral' | 'info' | 'positive' | 'negative' | 'warning';
  className?: string;
}) {
  return <span className={`tds-badge tds-badge-${variant} ${className}`.trim()}>{children}</span>;
}
