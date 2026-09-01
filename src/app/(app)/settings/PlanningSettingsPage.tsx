import { ensureHouseholdForCurrentUser, listHouseholdMembers } from '@/lib/household';
import { listFinancialGoals, listFinancialTasks } from '@/lib/excel-extended-data';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { HouseholdPlanning, type PlanningSection } from './HouseholdPlanning';
import { SettingsBackLink } from './SettingsBackLink';

export async function PlanningSettingsPage({ section, title, description }: { section: PlanningSection; title: string; description: string }) {
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const { toDate } = monthRangeFromSeoulDateString(`${today.slice(0, 7)}-01`);
  const [members, goals, tasks] = await Promise.all([
    listHouseholdMembers(household.id),
    listFinancialGoals(household.id),
    listFinancialTasks(household.id, today, toDate),
  ]);
  return <div className="tds-page"><SettingsBackLink /><div className="mt-4"><h1 className="tds-title mb-2">{title}</h1><p className="text-sm text-[var(--tds-grey-700)]">{description}</p></div><div className="mt-6"><HouseholdPlanning members={members} goals={goals} tasks={tasks} section={section} /></div></div>;
}
