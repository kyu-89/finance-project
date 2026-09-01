import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';
import { ensureHouseholdForCurrentUser, listHouseholdMembers } from '@/lib/household';
import { listFinancialGoals, listFinancialTasks } from '@/lib/excel-extended-data';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { HouseholdPlanning } from './HouseholdPlanning';

export default async function SettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const { toDate } = monthRangeFromSeoulDateString(`${today.slice(0, 7)}-01`);
  const [members, goals, tasks] = await Promise.all([listHouseholdMembers(household.id), listFinancialGoals(household.id), listFinancialTasks(household.id, today, toDate)]);
  return (
    <div className="tds-page">
      <h1 className="tds-title mb-2">설정을 관리해요</h1>
      <p className="mb-6 text-sm text-[var(--tds-grey-700)]">우리 집의 분류·결제 기준과 데이터를 관리해요. 예산과 반복항목은 월간관리에서 조정해요.</p>
      <HouseholdPlanning members={members} goals={goals} tasks={tasks} />
      <nav className="list-surface flex flex-col divide-y divide-[var(--tds-grey-200)]">
        <Link href="/settings/categories" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>카테고리 관리</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
        <Link href="/settings/payment-methods" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>결제수단 관리</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
        <Link href="/settings/data" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>거래 내역 가져오기</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
      </nav>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
