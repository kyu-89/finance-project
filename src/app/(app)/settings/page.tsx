import { SignOutButton } from '@/components/SignOutButton';
import { ensureHouseholdForCurrentUser, listHouseholdMembers } from '@/lib/household';
import { listFinancialGoals, listFinancialTasks } from '@/lib/excel-extended-data';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { HouseholdPlanning } from './HouseholdPlanning';
import { SettingsNav } from './SettingsNav';
import { SettingsSectionAnchors } from './SettingsSectionAnchors';

export default async function SettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const { toDate } = monthRangeFromSeoulDateString(`${today.slice(0, 7)}-01`);
  const [members, goals, tasks] = await Promise.all([listHouseholdMembers(household.id), listFinancialGoals(household.id), listFinancialTasks(household.id, today, toDate)]);
  return (
    <div className="tds-page">
      <h1 className="tds-title mb-2">설정을 관리해요</h1>
      <p className="mb-6 text-sm text-[var(--tds-grey-700)]">우리 집의 분류·결제 기준과 데이터를 관리해요. 예산과 반복항목은 월간관리에서 조정해요.</p>
      <SettingsSectionAnchors />
      <HouseholdPlanning members={members} goals={goals} tasks={tasks} />
      <SettingsNav />
      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
