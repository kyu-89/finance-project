import { listAccounts } from '@/lib/accounts';
import { todayInSeoul } from '@/lib/date';
import { listDeposits } from '@/lib/deposits';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listSavingsAccounts } from '@/lib/savings';
import { SavingsProductManager } from './SavingsProductManager';
import { listRecurringRules } from '@/lib/recurring-rules';
import { ProductRecurringInfo } from '@/components/ProductRecurringInfo';
import { ProductRecurringHistory } from '@/components/ProductRecurringHistory';
import { FinanceBackLink } from '../FinanceBackLink';
import { PageHeader } from '@/components/PageHeader';

export default async function FinanceSavingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [deposits, savings, accounts, rules] = await Promise.all([
    listDeposits(household.id), listSavingsAccounts(household.id), listAccounts(household.id), listRecurringRules(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6"><PageHeader eyebrow="자산·금융" title="예금·적금을 관리해요" description="납입 현황과 만기 정보를 관리해요."><FinanceBackLink /></PageHeader><SavingsProductManager deposits={deposits} savings={savings} accounts={accounts} today={todayInSeoul()} /><ProductRecurringInfo householdId={household.id} rules={rules} sourceType="saving" sourceIds={savings.map((item) => item.id)} /><ProductRecurringHistory householdId={household.id} rules={rules} sourceType="saving" sourceIds={savings.map((item) => item.id)} /></div>;
}
