import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { CategoryForm } from './CategoryForm';
import { DeactivateCategoryButton } from './DeactivateCategoryButton';
import { CategoryEditor } from './CategoryEditor';

export default async function CategoriesSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const categories = await listCategoriesWithSubcategories(household.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">카테고리 관리</h1>

      <CategoryForm />

      <ul className="flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id}>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <CategoryEditor category={category} />
              </div>
              {category.isActive && <DeactivateCategoryButton id={category.id} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
