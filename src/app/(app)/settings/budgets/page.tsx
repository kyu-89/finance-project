import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listBudgets } from '@/lib/budgets';
import { todayInSeoul } from '@/lib/date';
import { AnnualBudgetEditor } from './AnnualBudgetEditor';
import { SettingsBackLink } from '../SettingsBackLink';
import { PageHeader } from '@/components/PageHeader';

export default async function BudgetSettingsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const currentYear = Number(todayInSeoul().slice(0, 4));
  const requestedYear = Number(params.year ?? currentYear);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2200 ? requestedYear : currentYear;
  const household = await ensureHouseholdForCurrentUser();
  const [categories, budgets] = await Promise.all([listCategoriesWithSubcategories(household.id), listBudgets(household.id, year)]);
  return <div className="tds-page flex max-w-none flex-col gap-6">
    <PageHeader eyebrow="설정" title="예산을 관리해요" description="카테고리별 월 예산을 입력하고 지출과 비교해요." action={<div className="flex items-center gap-3"><Link href={`/settings/budgets?year=${year - 1}`} className="secondary-button flex items-center px-4">이전 연도</Link>
      <strong className="text-xl">{year}년</strong><Link href={`/settings/budgets?year=${year + 1}`} className="secondary-button flex items-center px-4">다음 연도</Link></div>
    }><SettingsBackLink /></PageHeader><AnnualBudgetEditor year={year} categories={categories} budgets={budgets} />
  </div>;
}
