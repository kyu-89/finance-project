import Link from 'next/link';
import type { DashboardPreset } from '@/lib/dashboard-calculations';

const presets: { key: DashboardPreset; label: string }[] = [
  { key: 'month', label: '이번 달' }, { key: 'last_month', label: '지난달' }, { key: 'ytd', label: '올해 누적' },
  { key: '3m', label: '최근 3개월' }, { key: '6m', label: '최근 6개월' }, { key: '12m', label: '최근 12개월' },
];

export function DashboardPeriodFilters({ month, member, active, customFrom = '', customTo = '' }: { month: string; member?: string; active: DashboardPreset; customFrom?: string; customTo?: string }) {
  const memberQuery = member ? `&member=${encodeURIComponent(member)}` : '';
  return <div className="mb-4 flex flex-wrap items-center gap-2"><nav aria-label="대시보드 기간" className="flex min-w-0 gap-2 overflow-x-auto pb-1">{presets.map((preset) => <Link key={preset.key} href={`/dashboard?month=${month}&preset=${preset.key}${memberQuery}`} className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold ${active === preset.key ? 'border-[var(--tds-blue-500)] bg-[var(--tds-blue-500)] text-white' : 'border-[var(--tds-grey-200)] bg-white text-[var(--tds-grey-700)]'}`}>{preset.label}</Link>)}</nav><form method="get" className={`flex shrink-0 items-end gap-2 rounded-xl border p-2 ${active === 'custom' ? 'border-[var(--tds-blue-500)]' : 'border-[var(--tds-grey-200)]'}`}><input type="hidden" name="month" value={month} />{member && <input type="hidden" name="member" value={member} />}<label className="text-xs font-semibold">시작일<input name="customFrom" type="date" defaultValue={customFrom} required className="mt-1 h-9 px-2 text-xs" /></label><label className="text-xs font-semibold">종료일<input name="customTo" type="date" defaultValue={customTo} required className="mt-1 h-9 px-2 text-xs" /></label><button name="preset" value="custom" type="submit" className="tds-button-secondary h-9 px-3 text-xs">조회</button></form></div>;
}
