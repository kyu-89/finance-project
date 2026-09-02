export function EmptyState({
  title,
  description,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`tds-empty-state ${className}`.trim()}>
      <p className="tds-empty-state-title">{title}</p>
      {description && <p className="tds-empty-state-description">{description}</p>}
      {action}
    </div>
  );
}
