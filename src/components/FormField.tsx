import type { ReactNode } from 'react';

export function FormField({
  label,
  children,
  className = '',
  hint,
  required = false,
  as = 'label',
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
  required?: boolean;
  as?: 'label' | 'div';
}) {
  const content = <>
    <span className="form-field-label">{label}</span>
    {children}
    {hint ? <small className="form-field-hint">{hint}</small> : null}
  </>;

  if (as === 'div') {
    return <div className={`form-field ${className}`.trim()} data-required={required || undefined}>{content}</div>;
  }

  return (
    <label className={`form-field ${className}`.trim()} data-required={required || undefined}>{content}</label>
  );
}
