import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listBudgets } from '@/lib/budgets';
import { todayInSeoul } from '@/lib/date';
import { AnnualBudgetEditor } from './AnnualBudgetEditor';

export default async function BudgetSettingsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const currentYear = Number(todayInSeoul().slice(0, 4));
  const requestedYear = Number(params.year ?? currentYear);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200 ? requestedYear : currentYear;
  const household = await ensureHouseholdForCurrentUser();
  const [categories, budgets] = await Promise.all([listCategoriesWithSubcategories(household.id), listBudgets(household.id, year)]);
  const expenseCategories = categories.filter((category) => category.transactionType === 'expense');
  return <div className="tds-page flex max-w-none flex-col gap-6">
    <div><h1 className="tds-title mb-2">연간 예산을 관리해요</h1><p className="text-sm text-[var(--tds-grey-700)]">카테고리별 월 예산을 원 단위로 입력해요.</p></div>
    <div className="flex items-center gap-3"><Link href={`/settings/budgets?year=${year - 1}`} className="secondary-button flex items-center px-4">이전 연도</Link>
      <strong className="text-xl">{year}년</strong><Link href={`/settings/budgets?year=${year + 1}`} className="secondary-button flex items-center px-4">다음 연도</Link></div>
    <AnnualBudgetEditor year={year} categories={expenseCategories} budgets={budgets} />
  </div>;
}
