import { listAccounts } from '@/lib/accounts';
import { PageHeader } from '@/components/PageHeader';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { AccountManager } from './AccountManager';
import { FinanceBackLink } from '../FinanceBackLink';

export default async function FinanceAccountsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const accounts = await listAccounts(household.id);
  return <div className="tds-page flex flex-col gap-6">
    <PageHeader eyebrow="자산·금융" title="계좌·증권을 관리해요" description="보유 중인 계좌와 증권의 현재 잔액을 관리해요."><FinanceBackLink /></PageHeader>
    <AccountManager accounts={accounts} />
  </div>;
}
