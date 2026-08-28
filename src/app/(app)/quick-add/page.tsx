import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listRecentUsage } from '@/lib/transactions';
import { QuickAddForm } from './QuickAddForm';

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; undo?: string; undone?: string }>;
}) {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, recentUsage, { saved, undo, undone }] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listRecentUsage(household.id),
    searchParams,
  ]);

  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.isActive);
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive).sort((a, b) => {
    const aRank = recentUsage.paymentMethodIds.indexOf(a.id);
    const bRank = recentUsage.paymentMethodIds.indexOf(b.id);
    if (aRank === bRank) return 0;
    if (aRank === -1) return 1;
    if (bRank === -1) return -1;
    return aRank - bRank;
  });

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">거래 기록</h1>
      <QuickAddForm
        categories={expenseCategories}
        paymentMethods={activePaymentMethods}
        recentCategoryIds={recentUsage.categoryIds}
        recentSubcategoryIdsByCategory={recentUsage.subcategoryIdsByCategory}
        saved={saved}
        undoId={undo}
        undone={undone === '1'}
      />
    </div>
  );
}
