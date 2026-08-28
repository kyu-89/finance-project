import Link from 'next/link';
import { listAccounts } from '@/lib/accounts';
import { todayInSeoul } from '@/lib/date';
import { listDeposits } from '@/lib/deposits';
import { ensureHouseholdForCurrentUser, listHouseholdMembers } from '@/lib/household';
import { listSavingsAccounts } from '@/lib/savings';
import { SavingsProductManager } from './SavingsProductManager';

export default async function FinanceSavingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [deposits, savings, accounts, members] = await Promise.all([
    listDeposits(household.id), listSavingsAccounts(household.id), listAccounts(household.id), listHouseholdMembers(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6"><div><Link href="/finance" className="text-sm font-semibold text-[var(--tds-blue-500)]">← 자산·금융 전체</Link><h1 className="tds-title mt-3">예금과 적금을 관리해요</h1></div><SavingsProductManager deposits={deposits} savings={savings} accounts={accounts} members={members} today={todayInSeoul()} /></div>;
}
