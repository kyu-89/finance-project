import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Category = {
  id: string;
  householdId: string;
  transactionType: 'income' | 'expense';
  name: string;
  defaultCostBehavior: 'fixed' | 'variable' | null;
  isActive: boolean;
};

export type Subcategory = {
  id: string;
  categoryId: string;
  name: string;
  isActive: boolean;
};

export type CategoryWithSubcategories = Category & { subcategories: Subcategory[] };

// PRD §4.3 — 지출 대분류 + 대표 소분류. Never hardcoded into UI components; this is the one
// seed-time source, used only by ensureDefaultCategoriesSeeded below.
//
// defaultCostBehavior — PRD §4.1's worked examples (월세/정액 관리비/보험료/통신 기본요금/
// 정기 구독 → fixed) map onto 주거비/보험비/통신비. 저축성지출 is excluded from fixed/variable
// analysis entirely (PRD §35), hence null. Everything else defaults to 'variable'. This is
// snapshotted onto every transaction at insert time (see resolveCostBehavior), so it must be
// right per-category up front — there is no UI yet to correct a wrong stamp after the fact.
export const DEFAULT_EXPENSE_CATEGORIES: {
  name: string;
  subcategoryNames: string[];
  defaultCostBehavior: 'fixed' | 'variable' | null;
}[] = [
  { name: '저축성지출', subcategoryNames: ['예/적금', '주택청약', '퇴직연금', '연금저축', '변액연금', '비상금', '투자', '상조', '기타 저축성'], defaultCostBehavior: null },
  { name: '식비', subcategoryNames: ['시장/마트', '외식', '간식', '술/회식', '카페', '기타 식비'], defaultCostBehavior: 'variable' },
  { name: '주거비', subcategoryNames: ['재산세', '주담대 이자', '주담대 원금', '관리비', '가스비', '정수기렌탈료', '기타 주거비'], defaultCostBehavior: 'fixed' },
  { name: '협찬', subcategoryNames: ['협찬/페이백'], defaultCostBehavior: 'variable' },
  { name: '생활용품비', subcategoryNames: ['가구/가전', '주방/욕실', '오피스/문구', '멤버십', '기타 생활용품', '기타 잡지출'], defaultCostBehavior: 'variable' },
  { name: '보험비', subcategoryNames: ['보장성', '연금보험', '건강보험', '연금크레딧'], defaultCostBehavior: 'fixed' },
  { name: '의류비', subcategoryNames: ['의류', '패션잡화', '세탁비', '기타 의류'], defaultCostBehavior: 'variable' },
  { name: '미용비', subcategoryNames: ['화장품구입', '헤어샵', '기타 미용'], defaultCostBehavior: 'variable' },
  { name: '교육계발비', subcategoryNames: ['학원', '도서', '강의', '기타 교육', '기타 자기계발'], defaultCostBehavior: 'variable' },
  { name: '문화생활비', subcategoryNames: ['영화/관람', '여가', '여행', 'OTT', '남편 용돈', '종소세세금', '지방세세금', '기타 문화생활'], defaultCostBehavior: 'variable' },
  { name: '의료비', subcategoryNames: ['병원', '의약품', '영양제', '기타 의료비'], defaultCostBehavior: 'variable' },
  { name: '유류교통비', subcategoryNames: ['자동차보험', '자동차세', '유류비', '기타 유지비', '버스/지하철', '택시', '기차', '항공', '기타 교통'], defaultCostBehavior: 'variable' },
  { name: '통신비', subcategoryNames: ['핸드폰', '인터넷/IPTV', '우편/택배', '기타 통신'], defaultCostBehavior: 'fixed' },
  { name: '이벤트지출', subcategoryNames: ['축의금', '부조금', '기부금', '모임회비', '선물', '기타 경조사'], defaultCostBehavior: 'variable' },
];

// PRD §4.3 — 수입 소분류 초기값. Income has a single implicit 대분류 ("수입") per §4.2's
// "대분류: 기본값 수입" — modeled as one category row named '수입' holding these subcategories.
export const DEFAULT_INCOME_SUBCATEGORY_NAMES = [
  '이월', '급여', '수당', '상여', '투자수익', '이자', '부수익', '처분소득', '기타 수입',
];

export async function ensureDefaultCategoriesSeeded(householdId: string): Promise<void> {
  const supabase = await createClient();

  // Check existence PER ROW (by transaction_type+name / by name), not just "does any category
  // exist for this household" — ~30 sequential inserts follow, and a bare existence guard would
  // mean a partial failure (race, transient network error, timeout) leaves the household
  // PERMANENTLY missing whatever didn't get inserted, since the guard would short-circuit before
  // ever retrying the gap. This makes every call (including the household's very next login)
  // fill in only what's actually still missing.
  const { data: existingCategories, error: existingError } = await supabase
    .from('categories')
    .select('id, transaction_type, name')
    .eq('household_id', householdId);

  if (existingError) {
    throw new Error(`카테고리 시드 확인 실패: ${existingError.message}`);
  }

  const existingCategoryIdByKey = new Map(
    (existingCategories ?? []).map((c) => [`${c.transaction_type}:${c.name}`, c.id as string]),
  );

  let incomeCategoryId = existingCategoryIdByKey.get('income:수입');
  if (!incomeCategoryId) {
    const { data: incomeCategory, error: incomeError } = await supabase
      .from('categories')
      .insert({ household_id: householdId, transaction_type: 'income', name: '수입' })
      .select('id')
      .single();

    if (incomeError) {
      throw new Error(`수입 카테고리 시드 실패: ${incomeError.message}`);
    }
    incomeCategoryId = incomeCategory.id as string;
  }

  // Resolve (inserting where missing) every expense category id first, so the subcategory pass
  // below can be done in one batched round-trip instead of one SELECT + one INSERT per category.
  const categoryIdAndSubcategoryNames: { categoryId: string; subcategoryNames: string[] }[] = [
    { categoryId: incomeCategoryId, subcategoryNames: DEFAULT_INCOME_SUBCATEGORY_NAMES },
  ];

  for (const [categoryIndex, category] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    let categoryId = existingCategoryIdByKey.get(`expense:${category.name}`);
    if (!categoryId) {
      const { data: expenseCategory, error: expenseError } = await supabase
        .from('categories')
        .insert({
          household_id: householdId,
          transaction_type: 'expense',
          name: category.name,
          default_cost_behavior: category.defaultCostBehavior,
          display_order: categoryIndex,
        })
        .select('id')
        .single();

      if (expenseError) {
        throw new Error(`지출 카테고리(${category.name}) 시드 실패: ${expenseError.message}`);
      }
      categoryId = expenseCategory.id as string;
    }

    categoryIdAndSubcategoryNames.push({ categoryId, subcategoryNames: category.subcategoryNames });
  }

  await ensureSubcategoriesSeededBatch(supabase, categoryIdAndSubcategoryNames);
}

// Batched replacement for the old per-category "SELECT then maybe INSERT" loop (~15 sequential
// round-trips against `subcategories` even when nothing was missing). Does exactly one SELECT
// across all category ids, then at most one bulk INSERT for whatever's missing across all of
// them. Still fully resumable: since it re-derives "missing" from a fresh SELECT on every call,
// a partial failure (this call's own bulk insert erroring out) just leaves gaps that the next
// call's SELECT will see and retry — same self-healing property as the old per-row loop.
async function ensureSubcategoriesSeededBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryIdAndSubcategoryNames: { categoryId: string; subcategoryNames: string[] }[],
): Promise<void> {
  const allCategoryIds = categoryIdAndSubcategoryNames.map((c) => c.categoryId);

  const { data: existingSubcategories, error: existingError } = await supabase
    .from('subcategories')
    .select('category_id, name')
    .in('category_id', allCategoryIds);

  if (existingError) {
    throw new Error(`소분류 시드 확인 실패: ${existingError.message}`);
  }

  const existingKeys = new Set(
    (existingSubcategories ?? []).map((s) => `${s.category_id}:${s.name}`),
  );

  const rows = categoryIdAndSubcategoryNames.flatMap(({ categoryId, subcategoryNames }) =>
    subcategoryNames
      .filter((name) => !existingKeys.has(`${categoryId}:${name}`))
      .map((name) => ({
        category_id: categoryId,
        name,
        display_order: subcategoryNames.indexOf(name),
      })),
  );

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from('subcategories').insert(rows);
  if (error) {
    throw new Error(`소분류 시드 실패: ${error.message}`);
  }
}

export async function listCategoriesWithSubcategories(
  householdId: string,
): Promise<CategoryWithSubcategories[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select(
      'id, household_id, transaction_type, name, default_cost_behavior, is_active, subcategories(id, category_id, name, is_active)',
    )
    .eq('household_id', householdId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
    .order('display_order', { referencedTable: 'subcategories', ascending: true })
    .order('name', { referencedTable: 'subcategories', ascending: true });

  if (error) {
    throw new Error(`카테고리 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    householdId: row.household_id,
    transactionType: row.transaction_type as 'income' | 'expense',
    name: row.name,
    defaultCostBehavior: row.default_cost_behavior as 'fixed' | 'variable' | null,
    isActive: row.is_active,
    subcategories: (row.subcategories ?? []).map((sub: { id: string; category_id: string; name: string; is_active: boolean }) => ({
      id: sub.id,
      categoryId: sub.category_id,
      name: sub.name,
      isActive: sub.is_active,
    })),
  }));
}

export async function createCategory(input: {
  householdId: string;
  transactionType: 'income' | 'expense';
  name: string;
  defaultCostBehavior: 'fixed' | 'variable' | null;
}): Promise<Category> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: input.householdId,
      transaction_type: input.transactionType,
      name: input.name,
      default_cost_behavior: input.defaultCostBehavior,
    })
    .select('id, household_id, transaction_type, name, default_cost_behavior, is_active')
    .single();

  if (error) {
    throw new Error(`카테고리 생성 실패: ${error.message}`);
  }

  return {
    id: data.id,
    householdId: data.household_id,
    transactionType: data.transaction_type,
    name: data.name,
    defaultCostBehavior: data.default_cost_behavior,
    isActive: data.is_active,
  };
}

export async function deactivateCategory(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ is_active: false }).eq('id', id);
  if (error) {
    throw new Error(`카테고리 비활성화 실패: ${error.message}`);
  }
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(`카테고리 상태 변경 실패: ${error.message}`);
}

export async function updateCategory(input: {
  id: string;
  name: string;
  defaultCostBehavior: 'fixed' | 'variable' | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({ name: input.name, default_cost_behavior: input.defaultCostBehavior })
    .eq('id', input.id);

  if (error) {
    throw new Error(`카테고리 수정 실패: ${error.message}`);
  }
}

export async function createSubcategory(input: { categoryId: string; name: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('subcategories')
    .insert({ category_id: input.categoryId, name: input.name });

  if (error) {
    throw new Error(`소분류 생성 실패: ${error.message}`);
  }
}

export async function updateSubcategory(input: { id: string; name: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('subcategories').update({ name: input.name }).eq('id', input.id);

  if (error) {
    throw new Error(`소분류 수정 실패: ${error.message}`);
  }
}

export async function deactivateSubcategory(id: string): Promise<void> {
  const supabase = await createClient();
  // Deactivate, never delete — existing transactions reference this row (§4.3, §23.2).
  const { error } = await supabase.from('subcategories').update({ is_active: false }).eq('id', id);

  if (error) {
    throw new Error(`소분류 비활성화 실패: ${error.message}`);
  }
}

export async function setSubcategoryActive(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('subcategories').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(`소분류 상태 변경 실패: ${error.message}`);
}
