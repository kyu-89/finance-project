import Link from 'next/link';
import type { DashboardPreset } from '@/lib/dashboard-calculations';

const presets: { key: DashboardPreset; label: string }[] = [
  { key: 'month', label: '이번 달' },
  { key: 'last_month', label: '지난달' },
  { key: 'ytd', label: '올해 누적' },
  { key: '3m', label: '최근 3개월' },
  { key: '6m', label: '최근 6개월' },
  { key: '12m', label: '최근 12개월' },
];

type Props = {
  month: string;
  member?: string;
  active: DashboardPreset;
  customFrom?: string;
  customTo?: string;
};

export function DashboardPeriodFilters({ month, member, active, customFrom = '', customTo = '' }: Props) {
  const memberQuery = member ? `&member=${encodeURIComponent(member)}` : '';
  const activeLabel = presets.find((preset) => preset.key === active)?.label ?? '직접 설정';
  const links = presets.map((preset) => (
    <Link
      key={preset.key}
      href={`/dashboard?month=${month}&preset=${preset.key}${memberQuery}`}
      className={active === preset.key ? 'is-selected' : undefined}
    >
      {preset.label}
    </Link>
  ));

  return (
    <section className="dashboard-period-filters mb-4" aria-label="대시보드 기간">
      <nav className="dashboard-period-presets dashboard-period-presets-desktop" aria-label="기간 빠른 선택">{links}</nav>
      <form method="get" className="dashboard-period-custom dashboard-period-custom-desktop">
        <input type="hidden" name="month" value={month} />
        {member && <input type="hidden" name="member" value={member} />}
        <label>시작일<input name="customFrom" type="date" defaultValue={customFrom} required /></label>
        <label>종료일<input name="customTo" type="date" defaultValue={customTo} required /></label>
        <button name="preset" value="custom" type="submit">조회</button>
      </form>
      <details className="dashboard-period-mobile">
        <summary><span>조회 기간</span><strong>{activeLabel}</strong><span aria-hidden="true">⌄</span></summary>
        <nav className="dashboard-period-presets" aria-label="모바일 기간 빠른 선택">{links}</nav>
        <form method="get" className="dashboard-period-custom">
          <input type="hidden" name="month" value={month} />
          {member && <input type="hidden" name="member" value={member} />}
          <label>시작일<input name="customFrom" type="date" defaultValue={customFrom} required /></label>
          <label>종료일<input name="customTo" type="date" defaultValue={customTo} required /></label>
          <button name="preset" value="custom" type="submit">조회</button>
        </form>
      </details>
    </section>
  );
}
