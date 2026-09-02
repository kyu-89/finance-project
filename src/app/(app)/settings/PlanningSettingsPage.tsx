import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listFinancialGoals, listFinancialTasks } from '@/lib/excel-extended-data';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { HouseholdPlanning, type PlanningSection } from './HouseholdPlanning';
import { SettingsBackLink } from './SettingsBackLink';

export async function PlanningSettingsPage({ section, title, description }: { section: PlanningSection; title: string; description: string }) {
  const household = await ensureHouseholdForCurrentUser();
  let goals: Awaited<ReturnType<typeof listFinancialGoals>> = [];
  let tasks: Awaited<ReturnType<typeof listFinancialTasks>> = [];

  if (section === 'goals') {
    goals = await listFinancialGoals(household.id);
  } else {
    const today = todayInSeoul();
    const { toDate } = monthRangeFromSeoulDateString(`${today.slice(0, 7)}-01`);
    tasks = await listFinancialTasks(household.id, today, toDate);
  }
  return <div className="tds-page"><SettingsBackLink /><div className="mt-4"><h1 className="tds-title mb-2">{title}</h1><p className="text-sm text-[var(--tds-grey-700)]">{description}</p></div><div className="mt-6"><HouseholdPlanning goals={goals} tasks={tasks} section={section} /></div></div>;
}
