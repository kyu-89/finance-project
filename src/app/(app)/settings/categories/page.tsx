import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { createCategoryAction, deactivateCategoryAction } from '@/actions/category-actions';

export default async function CategoriesSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const categories = await listCategoriesWithSubcategories(household.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">카테고리 관리</h1>

      <form action={createCategoryAction} className="flex flex-wrap items-end gap-2 rounded border p-4">
        <label className="flex flex-col gap-1 text-sm">
          유형
          <select name="transactionType" className="rounded border px-2 py-1">
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input name="name" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          기본 비용성격
          <select name="defaultCostBehavior" className="rounded border px-2 py-1">
            <option value="">(해당 없음)</option>
            <option value="fixed">고정비</option>
            <option value="variable">변동비</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">
          추가
        </button>
      </form>

      <ul className="flex flex-col gap-3">
        {categories.map((category) => (
          <li key={category.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <span className={category.isActive ? '' : 'text-gray-400 line-through'}>
                [{category.transactionType === 'income' ? '수입' : '지출'}] {category.name}
                {category.defaultCostBehavior && ` (${category.defaultCostBehavior === 'fixed' ? '고정비' : '변동비'})`}
              </span>
              {category.isActive && (
                <form action={deactivateCategoryAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <button type="submit" className="text-sm text-red-600">
                    비활성화
                  </button>
                </form>
              )}
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
