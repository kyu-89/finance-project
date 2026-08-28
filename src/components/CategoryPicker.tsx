'use client';

import { useState } from 'react';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function CategoryPicker({
  categories,
  onSelect,
}: {
  categories: CategoryWithSubcategories[];
  onSelect: (category: CategoryWithSubcategories, subcategoryId: string | null) => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              setSelectedCategoryId(category.id);
              // Switching 대분류 invalidates any 소분류 chosen under the previous one.
              setSelectedSubcategoryId(null);
              onSelect(category, null);
            }}
            className={`rounded border px-3 py-1 text-sm ${
              selectedCategoryId === category.id ? 'bg-black text-white' : ''
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
      {selectedCategory && selectedCategory.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategory.subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                setSelectedSubcategoryId(sub.id);
                onSelect(selectedCategory, sub.id);
              }}
              // Without a selected state these buttons registered the click but showed no
              // change at all, so the pick read as "not working" to the user.
              className={`rounded border px-2 py-1 text-xs ${
                selectedSubcategoryId === sub.id ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
