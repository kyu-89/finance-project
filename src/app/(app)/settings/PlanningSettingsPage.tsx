import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listFinancialGoals, listFinancialTasks } from '@/lib/excel-extended-data';
import { monthRangeFromSeoulDateString, todayInSeoul } from '@/lib/date';
import { HouseholdPlanning, type PlanningSection } from './HouseholdPlanning';
import { SettingsBackLink } from './SettingsBackLink';
import { PageHeader } from '@/components/PageHeader';

export async function PlanningSettingsPage({ section, title, description }: { section?: PlanningSection; title: string; description: string }) {
  const household = await ensureHouseholdForCurrentUser();
  let goals: Awaited<ReturnType<typeof listFinancialGoals>> = [];
  let tasks: Awaited<ReturnType<typeof listFinancialTasks>> = [];

  if (!section || section === 'goals') {
    goals = await listFinancialGoals(household.id);
  }
  if (!section || section === 'tasks') {
    const today = todayInSeoul();
    const { toDate } = monthRangeFromSeoulDateString(`${today.slice(0, 7)}-01`);
    tasks = await listFinancialTasks(household.id, today, toDate);
  }
  return <div className="tds-page"><PageHeader eyebrow="설정" title={title} description={description}><SettingsBackLink /></PageHeader><div className="mt-6"><HouseholdPlanning goals={goals} tasks={tasks} section={section} /></div></div>;
}
