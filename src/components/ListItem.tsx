'use client';

export function ListItem({
  title,
  description,
  metadata,
  badge,
  trailing,
  onClick,
  className = '',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  metadata?: React.ReactNode; // small muted line(s) below description — e.g. "만기일 2027-03-01"
  badge?: React.ReactNode; // typically a <Badge>, rendered near the title
  trailing?: React.ReactNode; // right-aligned slot — typically an <Amount>, or action buttons, or both stacked
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <div className="tds-list-item-body">
        <div className="tds-list-item-heading">
          <span className="tds-list-item-title">{title}</span>
          {badge}
        </div>
        {description && <div className="tds-list-item-description">{description}</div>}
        {metadata && <div className="tds-list-item-metadata">{metadata}</div>}
      </div>
      {trailing && <div className="tds-list-item-trailing">{trailing}</div>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`tds-list-item tds-list-item-button ${className}`.trim()} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={`tds-list-item ${className}`.trim()}>{content}</div>;
}
