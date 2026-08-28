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
export const DEFAULT_EXPENSE_CATEGORIES: { name: string; subcategoryNames: string[] }[] = [
  { name: '저축성지출', subcategoryNames: ['예/적금', '주택청약', '퇴직연금', '연금저축', '변액연금', '비상금', '투자', '상조', '기타 저축성'] },
  { name: '식비', subcategoryNames: ['시장/마트', '외식', '간식', '술/회식', '카페', '기타 식비'] },
  { name: '주거비', subcategoryNames: ['재산세', '주담대 이자', '주담대 원금', '관리비', '가스비', '정수기렌탈료', '기타 주거비'] },
  { name: '협찬', subcategoryNames: ['협찬/페이백'] },
  { name: '생활용품비', subcategoryNames: ['가구/가전', '주방/욕실', '오피스/문구', '멤버십', '기타 생활용품', '기타 잡지출'] },
  { name: '보험비', subcategoryNames: ['보장성', '연금보험', '건강보험', '연금크레딧'] },
  { name: '의류비', subcategoryNames: ['의류', '패션잡화', '세탁비', '기타 의류'] },
  { name: '미용비', subcategoryNames: ['화장품구입', '헤어샵', '기타 미용'] },
  { name: '교육계발비', subcategoryNames: ['학원', '도서', '강의', '기타 교육', '기타 자기계발'] },
  { name: '문화생활비', subcategoryNames: ['영화/관람', '여가', '여행', 'OTT', '남편 용돈', '종소세세금', '지방세세금', '기타 문화생활'] },
  { name: '의료비', subcategoryNames: ['병원', '의약품', '영양제', '기타 의료비'] },
  { name: '유류교통비', subcategoryNames: ['자동차보험', '자동차세', '유류비', '기타 유지비', '버스/지하철', '택시', '기차', '항공', '기타 교통'] },
  { name: '통신비', subcategoryNames: ['핸드폰', '인터넷/IPTV', '우편/택배', '기타 통신'] },
  { name: '이벤트지출', subcategoryNames: ['축의금', '부조금', '기부금', '모임회비', '선물', '기타 경조사'] },
];

// PRD §4.3 — 수입 소분류 초기값. Income has a single implicit 대분류 ("수입") per §4.2's
// "대분류: 기본값 수입" — modeled as one category row named '수입' holding these subcategories.
export const DEFAULT_INCOME_SUBCATEGORY_NAMES = [
  '이월', '급여', '수당', '상여', '투자수익', '이자', '부수익', '처분소득', '기타 수입',
];

const SAVING_CATEGORY_DEFAULT_COST_BEHAVIOR = null; // saving/investment excluded from fixed/variable (PRD §35)

export async function ensureDefaultCategoriesSeeded(householdId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .limit(1);

  if (existingError) {
    throw new Error(`카테고리 시드 확인 실패: ${existingError.message}`);
  }
  if (existing && existing.length > 0) {
    return; // already seeded for this household
  }

  const { data: incomeCategory, error: incomeError } = await supabase
    .from('categories')
    .insert({ household_id: householdId, transaction_type: 'income', name: '수입' })
    .select('id')
    .single();

  if (incomeError) {
    throw new Error(`수입 카테고리 시드 실패: ${incomeError.message}`);
  }

  const incomeSubcategoryRows = DEFAULT_INCOME_SUBCATEGORY_NAMES.map((name, index) => ({
    category_id: incomeCategory.id,
    name,
    display_order: index,
  }));

  const { error: incomeSubError } = await supabase.from('subcategories').insert(incomeSubcategoryRows);
  if (incomeSubError) {
    throw new Error(`수입 소분류 시드 실패: ${incomeSubError.message}`);
  }

  for (const [categoryIndex, category] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    const isSavingCategory = category.name === '저축성지출';

    const { data: expenseCategory, error: expenseError } = await supabase
      .from('categories')
      .insert({
        household_id: householdId,
        transaction_type: 'expense',
        name: category.name,
        default_cost_behavior: isSavingCategory ? SAVING_CATEGORY_DEFAULT_COST_BEHAVIOR : 'variable',
        display_order: categoryIndex,
      })
      .select('id')
      .single();

    if (expenseError) {
      throw new Error(`지출 카테고리(${category.name}) 시드 실패: ${expenseError.message}`);
    }

    const subcategoryRows = category.subcategoryNames.map((name, index) => ({
      category_id: expenseCategory.id,
      name,
      display_order: index,
    }));

    const { error: subError } = await supabase.from('subcategories').insert(subcategoryRows);
    if (subError) {
      throw new Error(`소분류(${category.name}) 시드 실패: ${subError.message}`);
    }
  }
}

export async function listCategoriesWithSubcategories(
  householdId: string,
): Promise<CategoryWithSubcategories[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, household_id, transaction_type, name, default_cost_behavior, is_active, subcategories(id, category_id, name, is_active)')
    .eq('household_id', householdId)
    .order('display_order', { ascending: true });

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
