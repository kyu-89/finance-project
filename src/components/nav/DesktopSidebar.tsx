import Link from 'next/link';
import { NAV_ITEMS } from '@/lib/nav-items';

export function DesktopSidebar() {
  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-2 border-r bg-white p-5 md:flex">
      <p className="mb-5 px-3 text-lg font-bold tracking-[-0.02em]">우리집 가계부</p>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="flex min-h-11 items-center rounded-xl px-4 text-[15px] font-semibold text-[var(--tds-grey-700)] hover:bg-[var(--tds-grey-100)] hover:text-[var(--tds-grey-900)]"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
