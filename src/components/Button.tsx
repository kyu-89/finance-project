'use client';

const VARIANT_CLASS: Record<'primary' | 'secondary' | 'ghost' | 'danger', string> = {
  primary: 'tds-primary-button',
  secondary: 'tds-button-secondary',
  ghost: 'tds-button-ghost',
  danger: 'tds-button-secondary tds-button-danger',
};

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled,
  className = '',
  ...rest
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
