import Link from 'next/link';
import type { DashboardPreset } from '@/lib/dashboard-calculations';

const presets: { key: DashboardPreset; label: string }[] = [
  { key: 'month', label: '이번 달' }, { key: 'last_month', label: '지난달' }, { key: 'ytd', label: '올해 누적' },
  { key: '3m', label: '최근 3개월' }, { key: '6m', label: '최근 6개월' }, { key: '12m', label: '최근 12개월' },
];

export function DashboardPeriodFilters({ month, member, active }: { month: string; member?: string; active: DashboardPreset }) {
  return <nav aria-label="대시보드 기간" className="mb-4 flex gap-2 overflow-x-auto pb-1">{presets.map((preset) => <Link key={preset.key} href={`/dashboard?month=${month}&preset=${preset.key}${member ? `&member=${member}` : ''}`} className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold ${active === preset.key ? 'border-[var(--tds-blue-500)] bg-[var(--tds-blue-500)] text-white' : 'border-[var(--tds-grey-200)] bg-white text-[var(--tds-grey-700)]'}`}>{preset.label}</Link>)}</nav>;
}
