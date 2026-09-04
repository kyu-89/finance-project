import Link from 'next/link';

type MenuCardTone = 'default' | 'warning';

export function MenuCard({ href, title, description, tone = 'default' }: {
  href: string;
  title: string;
  description: string;
  tone?: MenuCardTone;
}) {
  const toneClass = tone === 'warning'
    ? 'border-[var(--tds-yellow-500)] bg-[var(--tds-yellow-50)] hover:border-[var(--tds-yellow-700)]'
    : 'hover:border-[var(--tds-blue-300)] hover:bg-[var(--tds-blue-50)]';
  return (
    <Link
      href={href}
      className={`tds-card group flex min-h-20 items-center justify-between gap-4 p-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tds-blue-500)] ${toneClass}`}
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-6 text-[var(--tds-grey-900)]">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-[var(--tds-grey-600)]">{description}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-lg leading-none text-[var(--tds-grey-400)] transition-transform group-hover:translate-x-0.5">›</span>
    </Link>
  );
}
