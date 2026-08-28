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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[420px] items-center border border-b-0 bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_oklch(0.155_0.06_261/0.06)] md:hidden">
      {MOBILE_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex min-h-16 flex-1 items-center justify-center text-center text-xs font-semibold text-[var(--tds-grey-700)] ${
            item.href === '/quick-add'
              ? 'mx-1 my-2 min-h-12 rounded-2xl bg-[var(--tds-blue-500)] text-base text-white'
              : ''
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
