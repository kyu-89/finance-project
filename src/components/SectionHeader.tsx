export function SectionHeader({
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
    <div className={`tds-section-header ${className}`.trim()}>
      <div className="tds-section-header-text">
        <h2 className="tds-section-header-title">{title}</h2>
        {description && <p className="tds-section-header-description">{description}</p>}
      </div>
      {action && <div className="tds-section-header-action">{action}</div>}
    </div>
  );
}
