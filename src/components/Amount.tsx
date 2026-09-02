export function Amount({
  value,
  type = 'neutral',
  size = 'medium',
  showSign = false,
  className = '',
}: {
  value: number;
  type?: 'income' | 'expense' | 'neutral';
  size?: 'large' | 'medium' | 'small';
  showSign?: boolean;
  className?: string;
}) {
  const sign = showSign && type === 'income' ? '+' : showSign && type === 'expense' ? '-' : '';
  return (
    <strong className={`amount amount-${size} amount-${type} ${className}`.trim()}>
      {sign}{value.toLocaleString('ko-KR')}원
    </strong>
  );
}
