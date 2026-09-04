import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listRecentUsage } from '@/lib/transactions';
import { QuickAddForm } from './QuickAddForm';
import { listAccounts } from '@/lib/accounts';
import { PageHeader } from '@/components/PageHeader';

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; undo?: string; undone?: string }>;
}) {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, accounts, recentUsage, { saved, undo, undone }] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listAccounts(household.id),
    listRecentUsage(household.id),
    searchParams,
  ]);

  const activePaymentMethods = paymentMethods.filter((m) => m.isActive).sort((a, b) => {
    const aRank = recentUsage.paymentMethodIds.indexOf(a.id);
    const bRank = recentUsage.paymentMethodIds.indexOf(b.id);
    if (aRank === bRank) return 0;
    if (aRank === -1) return 1;
    if (bRank === -1) return -1;
    return aRank - bRank;
  });

  return (
    <div className="tds-page max-w-2xl">
      <PageHeader eyebrow="거래" title="거래를 기록해요" description="금액부터 입력하면 빠르게 저장할 수 있어요." />
      <QuickAddForm
        categories={categories.filter((c) => c.isActive)}
        paymentMethods={activePaymentMethods}
        accounts={accounts.filter((account) => account.status === 'active')}
        recentCategoryIds={recentUsage.categoryIds}
        recentSubcategoryIdsByCategory={recentUsage.subcategoryIdsByCategory}
        saved={saved}
        undoId={undo}
        undone={undone === '1'}
      />
    </div>
  );
}
