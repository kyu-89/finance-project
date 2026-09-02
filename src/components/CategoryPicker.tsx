'use client';

import { useState } from 'react';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function CategoryPicker({
  categories,
  recentCategoryIds = [],
  recentSubcategoryIdsByCategory = {},
  initialCategoryId = null,
  initialSubcategoryId = null,
  allowClearCategory = false,
  allowClearSubcategory = false,
  onSelect,
}: {
  categories: CategoryWithSubcategories[];
  recentCategoryIds?: string[];
  recentSubcategoryIdsByCategory?: Record<string, string[]>;
  // 수정 폼(거래 상세 드로어)은 이미 분류가 있는 거래를 열기 때문에, 이게 없으면 "아무것도
  // 선택 안 됨"으로 렌더돼 사용자가 이미 갖고 있던 값을 다시 골라야 한다. 생성 폼은 넘기지
  // 않고 빈 상태로 시작한다. 네이티브 input의 `defaultValue`처럼 useState 초기값으로 한 번만
  // 읽고, 이후 값의 주인은 호출부다.
  initialCategoryId?: string | null;
  initialSubcategoryId?: string | null;
  // 기존 네이티브 select가 `<option value="">미분류</option>` / `없음`으로 제공하던 "선택
  // 해제"를 칩으로 옮긴 것. 대분류/소분류가 서로 필수 여부가 다르므로 플래그를 분리했다
  // (예: 월간 추가 드로어는 대분류 필수 + 소분류 선택). 생성 폼 기준 둘 다 off가 기본값.
  allowClearCategory?: boolean;
  allowClearSubcategory?: boolean;
  // category가 null인 경우는 "미분류로 되돌리기"(allowClearCategory일 때만 발생).
  onSelect: (category: CategoryWithSubcategories | null, subcategoryId: string | null) => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(
    // 대분류 없이 소분류만 선택된 상태는 있을 수 없다.
    initialCategoryId ? initialSubcategoryId : null,
  );
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
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--tds-grey-500)]">1. 대분류를 선택하세요</p>
        <div className="flex flex-wrap gap-2">
        {allowClearCategory && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId(null);
              setSelectedSubcategoryId(null);
              onSelect(null, null);
            }}
            data-selected={selectedCategoryId === null}
            className="tds-chip px-4"
          >
            미분류
          </button>
        )}
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
      </div>
      {selectedCategory && orderedSubcategories.length > 0 && (
        <div className="rounded-2xl border border-[var(--tds-blue-100)] bg-[var(--tds-blue-50)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--tds-blue-600)]">2. {selectedCategory.name} 안에서 소분류를 선택하세요 <span className="font-normal">(선택사항)</span></p>
          <div className="flex flex-wrap gap-2">
          {allowClearSubcategory && (
            <button
              type="button"
              onClick={() => {
                setSelectedSubcategoryId(null);
                onSelect(selectedCategory, null);
              }}
              data-selected={selectedSubcategoryId === null}
              className="tds-chip min-h-10 px-3"
            >
              없음
            </button>
          )}
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
              className="tds-chip min-h-10 px-3"
            >
              {sub.name}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
