import { listCategoriesWithSubcategories } from '@/lib/categories';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { TransactionImport } from './TransactionImport';
import { DeletedTransactions } from './DeletedTransactions';
import { listRecentlyDeletedTransactions } from '@/lib/transactions';
import { InvestmentImport } from './InvestmentImport';
import { AccountImport } from './AccountImport';
import { SavingsProductsImport } from './SavingsProductsImport';
import { InsuranceImport } from './InsuranceImport';
import { LoanImport } from './LoanImport';
import { SupportEventImport } from './SupportEventImport';
import { PlanningImport } from './PlanningImport';
import { AssetCardImport } from './AssetCardImport';
import { AnnualAudit } from './AnnualAudit';
import { WorkbookMonthlyImport } from './WorkbookMonthlyImport';
import { FinancialAudit } from './FinancialAudit';
import { SettingsBackLink } from '../SettingsBackLink';
import { listImportSyncRuns } from '@/lib/import-history';
import { SyncHistory } from './SyncHistory';
import { DuplicateTransactionReview } from './DuplicateTransactionReview';
import { listDuplicateTransactionGroups } from '@/lib/duplicate-transaction-review';

export default async function DataSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, deletedTransactions, syncRuns, duplicateGroups] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id), listRecentlyDeletedTransactions(household.id), listImportSyncRuns(household.id),
    listDuplicateTransactionGroups(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6">
    <SettingsBackLink />
    <div><h1 className="tds-title">데이터 관리</h1><p className="mt-2 text-sm text-[var(--tds-grey-700)]">거래 파일을 업로드하거나 필요한 금융 데이터를 가져오고 내보내요.</p></div>
    <TransactionImport categories={categories.filter((category) => category.transactionType === 'expense' && category.isActive)} paymentMethods={paymentMethods.filter((method) => method.isActive)} />
    <details className="tds-card settings-advanced-imports"><summary>자산·금융 데이터 가져오기 <span>필요한 경우에만 열기</span></summary><div className="settings-advanced-imports-body"><InvestmentImport /><AccountImport /><SavingsProductsImport /><InsuranceImport /><LoanImport /><SupportEventImport /><PlanningImport /><AssetCardImport /><AnnualAudit /><FinancialAudit /></div></details>
    <section className="tds-card flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-lg font-bold">데이터 내보내기</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">2단계 인증이 완료된 세션에서만 금융 데이터를 내려받습니다.</p></div><div className="flex flex-wrap gap-2"><a href="/api/export/transactions" className="tds-button-secondary">거래 CSV</a><a href="/api/export/all" className="tds-button-secondary">전체 JSON</a></div></section>
    <WorkbookMonthlyImport categories={categories.filter((category) => category.isActive)} paymentMethods={paymentMethods.filter((method) => method.isActive)} />
    <SyncHistory runs={syncRuns} />
    <DuplicateTransactionReview groups={duplicateGroups} />
    <DeletedTransactions transactions={deletedTransactions} />
  </div>;
}
