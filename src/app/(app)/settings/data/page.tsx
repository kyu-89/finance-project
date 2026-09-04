import { listCategoriesWithSubcategories } from '@/lib/categories';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { TransactionImport } from './TransactionImport';
import { DeletedTransactions } from './DeletedTransactions';
import { listRecentlyDeletedTransactions } from '@/lib/transactions';
import { SettingsBackLink } from '../SettingsBackLink';
import { PageHeader } from '@/components/PageHeader';
import { listImportSyncRuns } from '@/lib/import-history';
import { SyncHistory } from './SyncHistory';
import { DuplicateTransactionReview } from './DuplicateTransactionReview';
import { listDuplicateTransactionGroups } from '@/lib/duplicate-transaction-review';
import { DataActionCard } from '@/components/DataActionCard';

export default async function DataSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, deletedTransactions, syncRuns, duplicateGroups] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id), listRecentlyDeletedTransactions(household.id), listImportSyncRuns(household.id),
    listDuplicateTransactionGroups(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6">
    <PageHeader eyebrow="설정" title="데이터를 관리해요" description="거래 데이터를 가져오고 내보내거나 검토해요."><SettingsBackLink /></PageHeader>
    <TransactionImport categories={categories.filter((category) => category.transactionType === 'expense' && category.isActive)} paymentMethods={paymentMethods.filter((method) => method.isActive)} />
    <DataActionCard title="데이터 내보내기" description="2단계 인증이 완료된 세션에서 필요한 데이터를 파일로 내려받아 보관해요."><a href="/api/export/transactions" className="tds-button-secondary flex w-full items-center justify-center">거래 CSV</a><a href="/api/export/all" className="tds-button-secondary flex w-full items-center justify-center">전체 JSON</a></DataActionCard>
    <SyncHistory runs={syncRuns} />
    <DuplicateTransactionReview groups={duplicateGroups} />
    <DeletedTransactions transactions={deletedTransactions} />
  </div>;
}
