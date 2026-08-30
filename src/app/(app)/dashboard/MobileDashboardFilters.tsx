'use client';

export function MobileDashboardFilters({ links, activeLabel }: { links: { label: string; href: string; active: boolean }[]; activeLabel: string }) {
  return <details className="mobile-dashboard-filters md:hidden">
    <summary className="flex min-h-11 w-full list-none items-center justify-between rounded-xl border border-[var(--tds-grey-200)] bg-white px-4 text-sm font-semibold">
      <span className="flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16M7 12h10M10 19h4" /></svg>필터 <span className="font-normal text-[var(--tds-grey-500)]">{activeLabel}</span></span><span aria-hidden="true" className="text-lg text-[var(--tds-grey-500)]">⌄</span>
    </summary>
    <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--tds-grey-200)] bg-white p-3">
      {links.map((link) => <a key={link.href} href={link.href} className={`flex min-h-10 items-center justify-center rounded-xl px-2 text-sm font-semibold ${link.active ? 'bg-[var(--tds-blue-500)] text-white' : 'bg-[var(--tds-grey-100)] text-[var(--tds-grey-700)]'}`}>{link.label}</a>)}
    </div>
  </details>;
}
