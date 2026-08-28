import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { QuickAddForm } from './QuickAddForm';

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods, { saved }] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    searchParams,
  ]);

  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.isActive);
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">거래 기록</h1>
      <QuickAddForm categories={expenseCategories} paymentMethods={activePaymentMethods} saved={saved} />
    </div>
  );
}
