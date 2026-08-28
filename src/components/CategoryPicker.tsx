'use client';

import { useState } from 'react';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function CategoryPicker({
  categories,
  recentCategoryIds = [],
  recentSubcategoryIdsByCategory = {},
  onSelect,
}: {
  categories: CategoryWithSubcategories[];
  recentCategoryIds?: string[];
  recentSubcategoryIdsByCategory?: Record<string, string[]>;
  onSelect: (category: CategoryWithSubcategories, subcategoryId: string | null) => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const orderedCategories = [...categories].sort((a, b) => {
    const aRank = recentCategoryIds.indexOf(a.id);
    const bRank = recentCategoryIds.indexOf(b.id);
    if (aRank === bRank) return 0;
    if (aRank === -1) return 1;
    if (bRank === -1) return -1;
    return aRank - bRank;
  });
  const recentSubcategoryIds = selectedCategory
    ? (recentSubcategoryIdsByCategory[selectedCategory.id] ?? [])
    : [];
  const orderedSubcategories = selectedCategory
    ? [...selectedCategory.subcategories].sort((a, b) => {
        const aRank = recentSubcategoryIds.indexOf(a.id);
        const bRank = recentSubcategoryIds.indexOf(b.id);
        if (aRank === bRank) return 0;
        if (aRank === -1) return 1;
        if (bRank === -1) return -1;
        return aRank - bRank;
      })
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {orderedCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              setSelectedCategoryId(category.id);
              // Switching 대분류 invalidates any 소분류 chosen under the previous one.
              setSelectedSubcategoryId(null);
              onSelect(category, null);
            }}
            data-selected={selectedCategoryId === category.id}
            className="tds-chip px-4"
          >
            {category.name}
          </button>
        ))}
      </div>
      {selectedCategory && orderedSubcategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {orderedSubcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                setSelectedSubcategoryId(sub.id);
                onSelect(selectedCategory, sub.id);
              }}
              // Without a selected state these buttons registered the click but showed no
              // change at all, so the pick read as "not working" to the user.
              data-selected={selectedSubcategoryId === sub.id}
              className="tds-chip px-4"
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
