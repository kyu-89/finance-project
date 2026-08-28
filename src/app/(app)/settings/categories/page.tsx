import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { CategoryForm } from './CategoryForm';
import { DeactivateCategoryButton } from './DeactivateCategoryButton';

export default async function CategoriesSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const categories = await listCategoriesWithSubcategories(household.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">카테고리 관리</h1>

      <CategoryForm />

      <ul className="flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <span className={category.isActive ? '' : 'text-gray-400 line-through'}>
                [{category.transactionType === 'income' ? '수입' : '지출'}] {category.name}
                {category.defaultCostBehavior && ` (${category.defaultCostBehavior === 'fixed' ? '고정비' : '변동비'})`}
              </span>
              {category.isActive && <DeactivateCategoryButton id={category.id} />}
            </div>
            {category.subcategories.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                {category.subcategories.map((sub) => sub.name).join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
