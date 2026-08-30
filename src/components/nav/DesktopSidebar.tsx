import Link from 'next/link';
import { NAV_ITEMS } from '@/lib/nav-items';

export function DesktopSidebar() {
  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-2 border-r bg-white p-5 md:flex">
      <div className="mb-5 px-3"><p className="text-xl font-extrabold tracking-[-0.04em]">우리집 재무</p><p className="mt-1 text-xs text-[var(--tds-grey-500)]">우리 집 돈의 흐름</p></div>
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
