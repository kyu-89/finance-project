import Link from 'next/link';
import { listAccounts } from '@/lib/accounts';
import { listCards } from '@/lib/cards';
import { ensureHouseholdForCurrentUser, listHouseholdMembers } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { AccountCardManager } from './AccountCardManager';

export default async function FinanceAccountsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [accounts, cards, members, paymentMethods] = await Promise.all([
    listAccounts(household.id), listCards(household.id), listHouseholdMembers(household.id), listPaymentMethods(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6">
    <div><Link href="/finance" className="text-sm font-semibold text-[var(--tds-blue-500)]">← 자산·금융 전체</Link><h1 className="tds-title mt-3">계좌와 카드를 관리해요</h1></div>
    <AccountCardManager accounts={accounts} cards={cards} members={members} paymentMethods={paymentMethods} />
  </div>;
}
