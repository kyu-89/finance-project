'use client';

export function Chip({
  children,
  selected = false,
  onClick,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
}) {
  if (onClick) {
    return (
      <button type={type} className={`tds-chip ${className}`.trim()} data-selected={selected} onClick={onClick}>
        {children}
      </button>
    );
  }

  return (
    <span className={`tds-chip ${className}`.trim()} data-selected={selected}>
      {children}
    </span>
  );
}
