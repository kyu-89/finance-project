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
              onClick={() => onSelect(selectedCategory, sub.id)}
              className="rounded border px-2 py-1 text-xs text-gray-600"
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
