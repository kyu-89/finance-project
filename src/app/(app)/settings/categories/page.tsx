import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { CategoryForm } from './CategoryForm';
import { CategoryEditor } from './CategoryEditor';
import { AddDrawer } from '@/components/Drawer';
import { SettingsBackLink } from '../SettingsBackLink';

export default async function CategoriesSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const categories = await listCategoriesWithSubcategories(household.id);

  return (
    <div className="tds-page flex max-w-4xl flex-col gap-6">
      <div><h1 className="tds-title mb-2">카테고리를 관리해요</h1><p className="text-sm text-[var(--tds-grey-700)]">새 분류를 추가하거나 기본 비용성격을 바꿀 수 있어요.</p></div>
      <SettingsBackLink />

      <AddDrawer title="카테고리 추가" description="거래 입력에서 사용할 분류를 추가하세요." triggerLabel="카테고리 추가"><CategoryForm /></AddDrawer>

      <ul className="settings-resource-list flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id}><CategoryEditor category={category} /></li>
        ))}
      </ul>
    </div>
  );
}
