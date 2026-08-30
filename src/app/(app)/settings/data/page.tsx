import Link from 'next/link';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { TransactionImport } from './TransactionImport';

export default async function DataSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
  ]);
  return <div className="tds-page flex flex-col gap-6">
    <div><Link href="/settings" className="text-sm font-semibold text-[var(--tds-blue-500)]">← 설정</Link><h1 className="tds-title mt-3">거래 내역 가져오기</h1><p className="mt-2 text-sm text-[var(--tds-grey-700)]">카드사나 은행에서 내려받은 Excel·CSV 파일을 거래 내역으로 추가해요.</p></div>
    <TransactionImport categories={categories.filter((category) => category.transactionType === 'expense' && category.isActive)} paymentMethods={paymentMethods.filter((method) => method.isActive)} />
  </div>;
}
