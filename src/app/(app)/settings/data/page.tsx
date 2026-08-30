import Link from 'next/link';
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

export default async function DataSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, deletedTransactions] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id), listRecentlyDeletedTransactions(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6">
    <div><Link href="/settings" className="text-sm font-semibold text-[var(--tds-blue-500)]">← 설정</Link><h1 className="tds-title mt-3">거래 내역 가져오기</h1><p className="mt-2 text-sm text-[var(--tds-grey-700)]">카드사나 은행에서 내려받은 Excel·CSV 파일을 거래 내역으로 추가해요.</p></div>
    <TransactionImport categories={categories.filter((category) => category.transactionType === 'expense' && category.isActive)} paymentMethods={paymentMethods.filter((method) => method.isActive)} />
    <InvestmentImport />
    <AccountImport />
    <SavingsProductsImport />
    <InsuranceImport />
    <LoanImport />
    <SupportEventImport />
    <PlanningImport />
    <AssetCardImport />
    <AnnualAudit />
    <FinancialAudit />
    <section className="tds-card flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-lg font-bold">데이터 내보내기</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">2단계 인증이 완료된 세션에서만 금융 데이터를 내려받습니다.</p></div><div className="flex flex-wrap gap-2"><a href="/api/export/transactions" className="tds-button-secondary">거래 CSV</a><a href="/api/export/all" className="tds-button-secondary">전체 JSON</a></div></section>
    <WorkbookMonthlyImport categories={categories.filter((category) => category.isActive)} paymentMethods={paymentMethods.filter((method) => method.isActive)} />
    <DeletedTransactions transactions={deletedTransactions} />
  </div>;
}
