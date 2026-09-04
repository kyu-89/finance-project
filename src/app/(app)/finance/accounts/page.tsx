import { listAccounts } from '@/lib/accounts';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { AccountManager } from './AccountManager';
import { FinanceBackLink } from '../FinanceBackLink';

export default async function FinanceAccountsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const accounts = await listAccounts(household.id);
  return <div className="tds-page flex flex-col gap-6">
    <div><FinanceBackLink /><h1 className="tds-title mt-3">계좌·증권을 관리해요</h1></div>
    <AccountManager accounts={accounts} />
  </div>;
}
