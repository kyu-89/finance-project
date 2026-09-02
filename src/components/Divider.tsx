export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`tds-divider ${className}`.trim()} />;
}
