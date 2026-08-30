import { ensureHouseholdForCurrentUser, listHouseholdMembers } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listRecentUsage } from '@/lib/transactions';
import { QuickAddForm } from './QuickAddForm';
import { listAccounts } from '@/lib/accounts';

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; undo?: string; undone?: string }>;
}) {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, accounts, members, recentUsage, { saved, undo, undone }] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listAccounts(household.id),
    listHouseholdMembers(household.id),
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
      <h1 className="tds-title mb-2">거래를 기록해요</h1>
      <p className="mb-6 text-[15px] text-[var(--tds-grey-700)]">금액부터 입력하면 빠르게 저장할 수 있어요.</p>
      <QuickAddForm
        categories={categories.filter((c) => c.isActive)}
        paymentMethods={activePaymentMethods}
        accounts={accounts.filter((account) => account.status === 'active')}
        members={members.filter((member) => member.isActive)}
        recentCategoryIds={recentUsage.categoryIds}
        recentSubcategoryIdsByCategory={recentUsage.subcategoryIdsByCategory}
        saved={saved}
        undoId={undo}
        undone={undone === '1'}
      />
    </div>
  );
}
