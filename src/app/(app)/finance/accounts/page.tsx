import Link from 'next/link';
import { listAccounts } from '@/lib/accounts';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { AccountManager } from './AccountManager';

export default async function FinanceAccountsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const accounts = await listAccounts(household.id);
  return <div className="tds-page flex flex-col gap-6">
    <div><Link href="/finance" className="text-sm font-semibold text-[var(--tds-blue-500)]">← 자산·금융 전체</Link><h1 className="tds-title mt-3">계좌와 증권을 관리해요</h1></div>
    <AccountManager accounts={accounts} />
  </div>;
}
