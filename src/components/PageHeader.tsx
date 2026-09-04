import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  children,
  className = 'tds-page-header',
  as = 'header',
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: 'header' | 'div';
}) {
  const Tag = as;
  return (
    <Tag className={className}>
      <div>
        {eyebrow ? <p className="tds-eyebrow">{eyebrow}</p> : null}
        <h1 className="tds-title">{title}</h1>
        {description ? <p className="tds-page-subtitle">{description}</p> : null}
        {children}
      </div>
      {action}
    </Tag>
  );
}
