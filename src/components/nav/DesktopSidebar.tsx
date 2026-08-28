import Link from 'next/link';
import { NAV_ITEMS } from '@/lib/nav-items';

export function DesktopSidebar() {
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r p-4 md:flex">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="rounded px-3 py-2 text-sm hover:bg-gray-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
