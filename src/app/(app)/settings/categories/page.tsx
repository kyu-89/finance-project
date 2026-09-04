import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { CategoryForm } from './CategoryForm';
import { CategoryEditor } from './CategoryEditor';
import { AddDrawer } from '@/components/Drawer';
import { SettingsBackLink } from '../SettingsBackLink';
import { PageHeader } from '@/components/PageHeader';

export default async function CategoriesSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const categories = await listCategoriesWithSubcategories(household.id);

  return (
    <div className="tds-page flex max-w-4xl flex-col gap-6">
      <PageHeader eyebrow="설정" title="카테고리를 관리해요" description="수입·지출에 사용할 대분류와 소분류를 관리해요." action={<AddDrawer title="카테고리 추가" description="거래 입력에서 사용할 분류를 추가하세요." triggerLabel="카테고리 추가"><CategoryForm /></AddDrawer>}><SettingsBackLink /></PageHeader>

      <ul className="settings-resource-list flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id}><CategoryEditor category={category} /></li>
        ))}
      </ul>
    </div>
  );
}
