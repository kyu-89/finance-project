import Link from 'next/link';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: '홈' },
  { href: '/monthly', label: '내역' },
  { href: '/quick-add', label: '＋' },
  { href: '/finance', label: '자산' },
  { href: '/settings', label: '더보기' },
] as const;

export function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t bg-white md:hidden">
      {MOBILE_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex-1 py-3 text-center text-xs"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
