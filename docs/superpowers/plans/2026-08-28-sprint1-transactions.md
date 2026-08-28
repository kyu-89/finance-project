# Sprint 1 — 거래 원장 + 월간관리 뼈대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core transaction ledger — `categories`/`subcategories`/`payment_methods` (user-managed, not hardcoded) and `transactions` (with `planned`/`posted`/`skipped` status, `flow_class`/`cost_behavior` analysis axes) — plus the three surfaces that read/write it: Settings' category/payment-method management, the mobile 10-second quick-add flow, and PC 월간관리's 전체내역 (list) and 월간입력 (spreadsheet-style entry) tabs.

**Architecture:** Same layered pattern as Sprint 0 — Postgres tables with RLS (household-scoped, same `households.owner_user_id = auth.uid()` join pattern), server-only data-access functions in `src/lib/`, Server Actions only where a Client Component actually needs to mutate data, TanStack Table for the PC spreadsheet view, React Hook Form + Zod for validated forms (installed in Sprint 0, unused until now). Recurring-rule generation (Sprint 2), budgets/dashboard (Sprint 3), and asset/loan/insurance FKs on `transactions` (Sprint 4) are explicitly out of scope — this sprint lays the columns for them (nullable, no FK yet) but does not build the features that populate them.

**Tech Stack:** Next.js App Router (TypeScript strict) · Supabase Postgres + RLS · @tanstack/react-table · react-hook-form + zod · Vitest (unit + integration)

**Spec:** `docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md` — sections 3 (데이터 모델), 4 (거래 원장), 5.1–5.3 (입력 UX), 18 (테이블/스키마), 19.3–19.6 (PC/모바일 메뉴), 20.2/20.6 (화면 상세), 23 (정합성), 27 (하지 말아야 할 것). Sprint boundary: §26 Sprint 1 bullet list.

## Global Constraints

- 금액은 `bigint`(원 단위)로 저장한다. float/double 금지. (§3.2, §27)
- 카테고리·결제수단을 코드에 하드코딩하지 않는다 — DB에서 CRUD 가능해야 한다. (§4.3, §27)
- 카테고리 삭제는 금지하고 기존 거래가 있으면 `inactive` 처리만 허용한다(FK가 끊기지 않게). (§4.3, §23.2)
- 계좌 간 이체(`transfer`)는 소비/지출 집계에 포함하지 않는다 — 스키마에 `flow_class='transfer'`로 구분해 두되, Sprint 1의 집계 로직은 이를 다루지 않는다(집계 자체는 Sprint 3). (§23.5, §27)
- 저축성지출(`saving`)을 소비성지출과 동일 취급하지 않는다 — `flow_class`로 구분. (§23.6)
- 대분류/소분류의 `default_cost_behavior`는 거래 생성 시 `transactions.cost_behavior`에 스냅샷처럼 복사하고, 이후 카테고리 기본값이 바뀌어도 과거 거래는 자동 변경하지 않는다. (§18 categories 추가 정책, §35)
- 모바일 빠른 입력은 금액→대분류→소분류→결제수단→내용→저장 순서를 지키고, 명의자/비고/태그는 `더보기` 뒤에 숨긴다. 처음부터 모든 상세 필드를 노출하지 않는다. (§5.1, §27)
- `status` 기본값은 `posted`이며 `planned`/`skipped`/`cancelled` 값도 스키마에서 허용한다(값을 채우는 반복엔진은 Sprint 2). (§26, §18)
- TypeScript strict 모드를 유지한다(`tsconfig.json`의 `strict: true`). 새 타입 셋업 파일을 추가하지 않는다. (Sprint 0 교훈)
- 모든 신규 사용자 데이터 테이블은 RLS를 활성화하고 `auth.uid()` 기반으로 격리한다. (§0.6, §16.2)
- MVP라도 모바일/PC 반응형을 동시에 지원한다. (§0.11)
- 계산/정합성 관련 로직은 자동 테스트를 작성한다. (§0.12)
- 1차 메뉴는 `대시보드/월간관리/자산·금융/설정` 4개로 고정 — 새 1차 메뉴를 만들지 않는다. 이 스프린트의 화면은 모두 기존 `월간관리`/`설정` 메뉴 내부에 들어간다. (§0.13, §19.1)

---

## File Structure

```
personal-finance/
  supabase/migrations/
    20260829010000_categories_and_payment_methods.sql
    20260829020000_transactions.sql
  src/
    lib/
      categories.ts          (server-only data access: list/create/update/deactivate categories+subcategories)
      payment-methods.ts     (server-only data access: list/create/update/deactivate)
      transactions.ts        (server-only data access: list with filters, create, update, soft-delete)
      cost-behavior.ts       (pure helper: resolve effective cost_behavior for a category)
    actions/
      category-actions.ts    (Server Actions wrapping lib/categories.ts, for Client Component forms)
      payment-method-actions.ts
      transaction-actions.ts
    app/
      (app)/
        settings/
          page.tsx            (replaced: links to category/payment-method management)
          categories/page.tsx (list + add/deactivate form)
          payment-methods/page.tsx (list + add/deactivate form)
        quick-add/
          page.tsx            (replaced: real 5-step quick add flow)
        monthly/
          page.tsx            (replaced: tab shell — 월간입력 / 전체내역)
          MonthlyInputTab.tsx (TanStack Table spreadsheet-style entry)
          AllTransactionsTab.tsx (filterable list)
    components/
      CategoryPicker.tsx      (shared: recent-first category/subcategory picker used by quick-add + monthly input)
  tests/
    unit/
      cost-behavior.test.ts
    integration/
      rls-transactions.test.ts (extends the Sprint 0 pattern to categories/payment_methods/transactions)
```

---

### Task 1: Database schema — `categories` / `subcategories` / `payment_methods` + RLS + seed data

**Files:**
- Create: `supabase/migrations/20260829010000_categories_and_payment_methods.sql`

**Interfaces:**
- Produces: tables `public.categories(id, household_id, transaction_type, name, default_cost_behavior, display_order, is_active, created_at, updated_at)`, `public.subcategories(id, category_id, name, display_order, is_active, created_at, updated_at)`, `public.payment_methods(id, household_id, name, method_type, display_order, is_active, created_at, updated_at)` — all RLS-enabled, all seeded with PRD §4.3's default values scoped to no specific household (seeded per-household on first access — see Task 3).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260829010000_categories_and_payment_methods.sql`:

```sql
-- categories: 대분류. Scoped to income or expense (PRD §4.2 "대분류: 기본값 수입").
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  name text not null,
  default_cost_behavior text null check (default_cost_behavior in ('fixed', 'variable')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, transaction_type, name)
);

-- subcategories: 소분류, one level under a category.
create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

-- payment_methods: 결제수단/지출구분. Never hardcoded in app code (PRD §4.3, §27).
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  method_type text not null default 'other'
    check (method_type in ('account_transfer', 'cash', 'credit_card', 'check_card', 'other')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index categories_household_id_idx on public.categories (household_id);
create index subcategories_category_id_idx on public.subcategories (category_id);
create index payment_methods_household_id_idx on public.payment_methods (household_id);

alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.payment_methods enable row level security;

-- categories: owner-scoped through household_id, same pattern as household_members (Task 0 Sprint).
create policy "categories: owner select"
on public.categories for select
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "categories: owner insert"
on public.categories for insert
to authenticated
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "categories: owner update"
on public.categories for update
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
)
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

-- No delete policy: categories are deactivated (is_active = false), never deleted, so FKs from
-- transactions never break (PRD §4.3, §23.2). Omitting a delete policy means DELETE is denied
-- by default under RLS.

-- subcategories: gated through the parent category's household ownership.
create policy "subcategories: owner select"
on public.subcategories for select
to authenticated
using (
  category_id in (
    select c.id from public.categories c
    join public.households h on h.id = c.household_id
    where h.owner_user_id = (select auth.uid())
  )
);

create policy "subcategories: owner insert"
on public.subcategories for insert
to authenticated
with check (
  category_id in (
    select c.id from public.categories c
    join public.households h on h.id = c.household_id
    where h.owner_user_id = (select auth.uid())
  )
);

create policy "subcategories: owner update"
on public.subcategories for update
to authenticated
using (
  category_id in (
    select c.id from public.categories c
    join public.households h on h.id = c.household_id
    where h.owner_user_id = (select auth.uid())
  )
)
with check (
  category_id in (
    select c.id from public.categories c
    join public.households h on h.id = c.household_id
    where h.owner_user_id = (select auth.uid())
  )
);

-- payment_methods: same owner-scoped pattern as categories.
create policy "payment_methods: owner select"
on public.payment_methods for select
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "payment_methods: owner insert"
on public.payment_methods for insert
to authenticated
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "payment_methods: owner update"
on public.payment_methods for update
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
)
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);
```

- [ ] **Step 2: [MANUAL — user only] Push the migration**

```
! npx supabase login --token <fresh PAT, then revoke it after this step>
! npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260829010000_categories_and_payment_methods.sql
git commit -m "feat: categories/subcategories/payment_methods schema with RLS"
```

---

### Task 2: Database schema — `transactions` + RLS + indexes

**Files:**
- Create: `supabase/migrations/20260829020000_transactions.sql`

**Interfaces:**
- Consumes: `categories`, `subcategories`, `payment_methods`, `household_members` (Task 1, Sprint 0).
- Produces: table `public.transactions` with all columns from PRD §18's schema that this sprint's features actually use, plus placeholder nullable columns (no FK yet) for fields owned by future sprints.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260829020000_transactions.sql`:

```sql
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_date date not null,
  transaction_type text not null
    check (transaction_type in (
      'income', 'expense', 'saving', 'investment', 'debt_principal',
      'finance_cost', 'transfer', 'asset_adjustment', 'refund'
    )),
  flow_class text not null
    check (flow_class in (
      'cash_in', 'consumption', 'saving', 'investment', 'debt_principal',
      'finance_cost', 'transfer', 'adjustment'
    )),
  cost_behavior text null check (cost_behavior in ('fixed', 'variable')),
  income_group text null check (income_group in ('fixed', 'additional')),
  payment_method_id uuid null references public.payment_methods (id) on delete set null,
  category_id uuid null references public.categories (id) on delete set null,
  subcategory_id uuid null references public.subcategories (id) on delete set null,
  payer_member_id uuid null references public.household_members (id) on delete set null,
  beneficiary_member_id uuid null references public.household_members (id) on delete set null,
  -- Placeholder columns for later sprints — no FK yet, tables don't exist:
  account_id uuid null,               -- FK added in Sprint 4 (accounts table)
  recurring_rule_id uuid null,        -- FK added in Sprint 2 (recurring_rules table)
  recurring_occurrence_id uuid null,  -- FK added in Sprint 2 (recurring_occurrences table)
  insurance_id uuid null,             -- FK added in Sprint 4 (insurances table)
  saving_account_id uuid null,        -- FK added in Sprint 4 (savings_accounts table)
  loan_id uuid null,                  -- FK added in Sprint 4 (loans table)
  amount bigint not null check (amount > 0),
  description text not null,
  memo text null,
  include_in_budget boolean not null default true,
  needs_review boolean not null default false,
  parent_transaction_id uuid null references public.transactions (id) on delete set null,
  status text not null default 'posted' check (status in ('planned', 'posted', 'skipped', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index transactions_household_date_idx on public.transactions (household_id, transaction_date);
create index transactions_household_category_date_idx
  on public.transactions (household_id, category_id, transaction_date);
create index transactions_household_cost_behavior_date_idx
  on public.transactions (household_id, cost_behavior, transaction_date);
create index transactions_household_subcategory_date_idx
  on public.transactions (household_id, subcategory_id, transaction_date);
create index transactions_household_payment_method_date_idx
  on public.transactions (household_id, payment_method_id, transaction_date);
create index transactions_household_payer_date_idx
  on public.transactions (household_id, payer_member_id, transaction_date);
create index transactions_household_beneficiary_date_idx
  on public.transactions (household_id, beneficiary_member_id, transaction_date);

alter table public.transactions enable row level security;

create policy "transactions: owner select"
on public.transactions for select
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "transactions: owner insert"
on public.transactions for insert
to authenticated
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "transactions: owner update"
on public.transactions for update
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
)
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

-- No DELETE policy, matching categories/subcategories/payment_methods: PRD §5.4 requires
-- deleted transactions to stay recoverable for 30 days, so hard delete must never be reachable
-- at all — not even as a "safety net" a buggy or malicious direct SDK call could hit. The app
-- layer (Task 5's `transactions.ts`) sets `deleted_at` via UPDATE and filters `deleted_at is
-- null` in all reads instead. Omitting a DELETE policy means DELETE is denied by default under
-- RLS for every caller, including the household's own owner.
```

> **Note on soft delete (§5.4):** deletion is UPDATE-only (`deleted_at` timestamp), never SQL DELETE — see the comment above. Do not add application code that calls `.delete()` on this table; there is no policy that would allow it to succeed.

- [ ] **Step 2: [MANUAL — user only] Push the migration**

```
! npx supabase login --token <fresh PAT, then revoke it after this step>
! npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260829020000_transactions.sql
git commit -m "feat: transactions schema with RLS and analysis-axis indexes"
```

---

### Task 3: Category/payment-method data-access layer + household-scoped seeding

**Files:**
- Create: `src/lib/categories.ts`, `src/lib/payment-methods.ts`
- Test: `tests/unit/seed-data.test.ts`

**Interfaces:**
- Consumes: `createClient` (server, Sprint 0 Task 3), `households` (Sprint 0 Task 4).
- Produces: `listCategoriesWithSubcategories(): Promise<CategoryWithSubcategories[]>`, `ensureDefaultCategoriesSeeded(): Promise<void>`, `createCategory(input): Promise<Category>`, `deactivateCategory(id): Promise<void>`, `listPaymentMethods(): Promise<PaymentMethod[]>`, `ensureDefaultPaymentMethodsSeeded(): Promise<void>`, `createPaymentMethod(input): Promise<PaymentMethod>`, `deactivatePaymentMethod(id): Promise<void>`.

- [ ] **Step 1: Write the failing seed-data test**

Create `tests/unit/seed-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SUBCATEGORY_NAMES } from '@/lib/categories';
import { DEFAULT_PAYMENT_METHOD_NAMES } from '@/lib/payment-methods';

describe('seed data', () => {
  it('defines exactly the 14 PRD expense categories, each with at least one subcategory', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(14);
    for (const category of DEFAULT_EXPENSE_CATEGORIES) {
      expect(category.subcategoryNames.length).toBeGreaterThan(0);
    }
  });

  it('includes the PRD default income subcategory names', () => {
    expect(DEFAULT_INCOME_SUBCATEGORY_NAMES).toEqual([
      '이월', '급여', '수당', '상여', '투자수익', '이자', '부수익', '처분소득', '기타 수입',
    ]);
  });

  it('seeds 계좌이체 and 현금 as universal default payment methods', () => {
    expect(DEFAULT_PAYMENT_METHOD_NAMES).toEqual(['계좌이체', '현금']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- seed-data.test.ts`
Expected: FAIL — `Cannot find module '@/lib/categories'`.

- [ ] **Step 3: Implement `src/lib/categories.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/lib/payment-methods.ts`**

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type PaymentMethod = {
  id: string;
  householdId: string;
  name: string;
  methodType: 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';
  isActive: boolean;
};

// PRD §4.3 — only 계좌이체/현금 are universal enough to seed by default; the user's actual
// cards are personal data they add themselves via CRUD, never hardcoded (§27).
export const DEFAULT_PAYMENT_METHOD_NAMES = ['계좌이체', '현금'];

export async function ensureDefaultPaymentMethodsSeeded(householdId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from('payment_methods')
    .select('id')
    .eq('household_id', householdId)
    .limit(1);

  if (existingError) {
    throw new Error(`결제수단 시드 확인 실패: ${existingError.message}`);
  }
  if (existing && existing.length > 0) {
    return;
  }

  const rows = [
    { household_id: householdId, name: '계좌이체', method_type: 'account_transfer', display_order: 0 },
    { household_id: householdId, name: '현금', method_type: 'cash', display_order: 1 },
  ];

  const { error } = await supabase.from('payment_methods').insert(rows);
  if (error) {
    throw new Error(`결제수단 시드 실패: ${error.message}`);
  }
}

export async function listPaymentMethods(householdId: string): Promise<PaymentMethod[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, household_id, name, method_type, is_active')
    .eq('household_id', householdId)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`결제수단 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    methodType: row.method_type,
    isActive: row.is_active,
  }));
}

export async function createPaymentMethod(input: {
  householdId: string;
  name: string;
  methodType: PaymentMethod['methodType'];
}): Promise<PaymentMethod> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ household_id: input.householdId, name: input.name, method_type: input.methodType })
    .select('id, household_id, name, method_type, is_active')
    .single();

  if (error) {
    throw new Error(`결제수단 생성 실패: ${error.message}`);
  }

  return {
    id: data.id,
    householdId: data.household_id,
    name: data.name,
    methodType: data.method_type,
    isActive: data.is_active,
  };
}

export async function deactivatePaymentMethod(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('payment_methods').update({ is_active: false }).eq('id', id);
  if (error) {
    throw new Error(`결제수단 비활성화 실패: ${error.message}`);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- seed-data.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Wire seeding into the household bootstrap**

Modify `src/lib/household.ts` (from Sprint 0 Task 7): after `ensureSelfMember(supabase, household.id)` succeeds inside `ensureHouseholdForCurrentUser`, call `ensureDefaultCategoriesSeeded(household.id)` and `ensureDefaultPaymentMethodsSeeded(household.id)` (import both). This makes every household's categories/payment methods seed automatically on first login, matching how `ensureSelfMember` self-heals — no separate onboarding step needed.

- [ ] **Step 7: Run full suite + build**

Run: `npm test && npm run build`
Expected: all pass, clean build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: category/payment-method data access + household-scoped default seeding"
```

---

### Task 4: Settings > 카테고리·결제수단 management pages

**Files:**
- Create: `src/actions/category-actions.ts`, `src/actions/payment-method-actions.ts`, `src/app/(app)/settings/categories/page.tsx`, `src/app/(app)/settings/payment-methods/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx` (add links to the two new subpages)

**Interfaces:**
- Consumes: `src/lib/categories.ts`, `src/lib/payment-methods.ts` (Task 3), `ensureHouseholdForCurrentUser` (`src/lib/household.ts`, Sprint 0).

- [ ] **Step 1: Category Server Actions**

Create `src/actions/category-actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createCategory, deactivateCategory } from '@/lib/categories';
import { ensureHouseholdForCurrentUser } from '@/lib/household';

export async function createCategoryAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();
  const name = String(formData.get('name') ?? '').trim();
  const transactionType = formData.get('transactionType') === 'income' ? 'income' : 'expense';
  const defaultCostBehaviorRaw = formData.get('defaultCostBehavior');
  const defaultCostBehavior =
    defaultCostBehaviorRaw === 'fixed' || defaultCostBehaviorRaw === 'variable' ? defaultCostBehaviorRaw : null;

  if (!name) {
    throw new Error('카테고리 이름을 입력해주세요.');
  }

  await createCategory({ householdId: household.id, transactionType, name, defaultCostBehavior });
  revalidatePath('/settings/categories');
}

export async function deactivateCategoryAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    throw new Error('카테고리 id가 없습니다.');
  }
  await deactivateCategory(id);
  revalidatePath('/settings/categories');
}
```

- [ ] **Step 2: Payment method Server Actions**

Create `src/actions/payment-method-actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createPaymentMethod, deactivatePaymentMethod } from '@/lib/payment-methods';
import { ensureHouseholdForCurrentUser } from '@/lib/household';

export async function createPaymentMethodAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();
  const name = String(formData.get('name') ?? '').trim();
  const methodType = String(formData.get('methodType') ?? 'other') as
    | 'account_transfer' | 'cash' | 'credit_card' | 'check_card' | 'other';

  if (!name) {
    throw new Error('결제수단 이름을 입력해주세요.');
  }

  await createPaymentMethod({ householdId: household.id, name, methodType });
  revalidatePath('/settings/payment-methods');
}

export async function deactivatePaymentMethodAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    throw new Error('결제수단 id가 없습니다.');
  }
  await deactivatePaymentMethod(id);
  revalidatePath('/settings/payment-methods');
}
```

- [ ] **Step 3: Categories management page**

Create `src/app/(app)/settings/categories/page.tsx`:

```tsx
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
```

- [ ] **Step 4: Payment methods management page**

Create `src/app/(app)/settings/payment-methods/page.tsx`:

```tsx
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { createPaymentMethodAction, deactivatePaymentMethodAction } from '@/actions/payment-method-actions';

export default async function PaymentMethodsSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const paymentMethods = await listPaymentMethods(household.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">결제수단 관리</h1>

      <form action={createPaymentMethodAction} className="flex flex-wrap items-end gap-2 rounded border p-4">
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input name="name" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          종류
          <select name="methodType" className="rounded border px-2 py-1">
            <option value="credit_card">신용카드</option>
            <option value="check_card">체크카드</option>
            <option value="account_transfer">계좌이체</option>
            <option value="cash">현금</option>
            <option value="other">기타</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">
          추가
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {paymentMethods.map((method) => (
          <li key={method.id} className="flex items-center justify-between rounded border p-3">
            <span className={method.isActive ? '' : 'text-gray-400 line-through'}>{method.name}</span>
            {method.isActive && (
              <form action={deactivatePaymentMethodAction}>
                <input type="hidden" name="id" value={method.id} />
                <button type="submit" className="text-sm text-red-600">
                  비활성화
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Link from the Settings placeholder**

Modify `src/app/(app)/settings/page.tsx` — replace its placeholder body with links:

```tsx
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">설정</h1>
      <nav className="flex flex-col gap-2">
        <Link href="/settings/categories" className="underline">
          카테고리 관리
        </Link>
        <Link href="/settings/payment-methods" className="underline">
          결제수단 관리
        </Link>
      </nav>
    </div>
  );
}
```

(The `<SignOutButton />` added in Sprint 0's final fix wave stays on this page — add these links alongside it, don't remove it.)

- [ ] **Step 6: Manual verification + build**

Run: `npm run build`. Manually confirm (dev server) that `/settings/categories` shows the seeded 14 expense + 1 income category with their subcategories, and `/settings/payment-methods` shows 계좌이체/현금 — confirming Task 3's seeding actually ran for your household.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Settings category/payment-method management pages"
```

---

### Task 5: Transaction data-access layer

**Files:**
- Create: `src/lib/transactions.ts`, `src/lib/cost-behavior.ts`
- Test: `tests/unit/cost-behavior.test.ts`

**Interfaces:**
- Consumes: `categories`/`subcategories`/`payment_methods` (Task 1), `transactions` (Task 2).
- Produces: `resolveCostBehavior(transactionType, categoryDefaultCostBehavior, overrideCostBehavior): 'fixed' | 'variable' | null`, `createTransaction(input): Promise<Transaction>`, `listTransactions(filter): Promise<Transaction[]>`, `softDeleteTransaction(id): Promise<void>`.

- [ ] **Step 1: Write the failing cost-behavior test**

Create `tests/unit/cost-behavior.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveCostBehavior } from '@/lib/cost-behavior';

describe('resolveCostBehavior', () => {
  it('returns null for non-expense transaction types regardless of inputs', () => {
    expect(resolveCostBehavior('income', 'fixed', 'variable')).toBeNull();
    expect(resolveCostBehavior('saving', 'fixed', null)).toBeNull();
    expect(resolveCostBehavior('transfer', null, 'fixed')).toBeNull();
  });

  it('uses the explicit override when provided for an expense', () => {
    expect(resolveCostBehavior('expense', 'variable', 'fixed')).toBe('fixed');
  });

  it("falls back to the category's default_cost_behavior when no override is given", () => {
    expect(resolveCostBehavior('expense', 'fixed', null)).toBe('fixed');
    expect(resolveCostBehavior('expense', 'variable', null)).toBe('variable');
  });

  it('returns null when an expense has no override and no category default (e.g. 저축성지출)', () => {
    expect(resolveCostBehavior('expense', null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cost-behavior.test.ts`
Expected: FAIL — `Cannot find module '@/lib/cost-behavior'`.

- [ ] **Step 3: Implement `src/lib/cost-behavior.ts`**

```ts
export type CostBehavior = 'fixed' | 'variable' | null;
export type TransactionType =
  | 'income' | 'expense' | 'saving' | 'investment' | 'debt_principal'
  | 'finance_cost' | 'transfer' | 'asset_adjustment' | 'refund';

// PRD §4.1 "비용 성격(cost behavior)": only expense (and, per §4.1's own text, finance_cost —
// deferred to whichever sprint implements loan interest transactions) carries fixed/variable.
// Sprint 1 only creates 'expense' transactions through the UI, so this function's practical
// input is always 'expense', but it's written to be correct for every transaction_type up front
// per PRD §35 ("적금/투자이체/대출원금 등 자산·부채 이동은 고정비/변동비 소비 분석에서 제외").
export function resolveCostBehavior(
  transactionType: TransactionType,
  categoryDefaultCostBehavior: CostBehavior,
  override: CostBehavior,
): CostBehavior {
  if (transactionType !== 'expense') {
    return null;
  }
  return override ?? categoryDefaultCostBehavior;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cost-behavior.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Implement `src/lib/transactions.ts`**

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { resolveCostBehavior, type TransactionType } from '@/lib/cost-behavior';

export type Transaction = {
  id: string;
  householdId: string;
  transactionDate: string;
  transactionType: TransactionType;
  flowClass: string;
  costBehavior: 'fixed' | 'variable' | null;
  paymentMethodId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  payerMemberId: string | null;
  beneficiaryMemberId: string | null;
  amount: number;
  description: string;
  memo: string | null;
  includeInBudget: boolean;
  needsReview: boolean;
  status: 'planned' | 'posted' | 'skipped' | 'cancelled';
};

// PRD §1.4 — maps transaction_type to the flow_class analysis axis. Kept as a single
// source of truth so no two call sites can disagree on which flow_class a type maps to.
const FLOW_CLASS_BY_TRANSACTION_TYPE: Record<TransactionType, string> = {
  income: 'cash_in',
  expense: 'consumption',
  saving: 'saving',
  investment: 'investment',
  debt_principal: 'debt_principal',
  finance_cost: 'finance_cost',
  transfer: 'transfer',
  asset_adjustment: 'adjustment',
  refund: 'cash_in',
};

function mapRow(row: {
  id: string; household_id: string; transaction_date: string; transaction_type: string;
  flow_class: string; cost_behavior: string | null; payment_method_id: string | null;
  category_id: string | null; subcategory_id: string | null; payer_member_id: string | null;
  beneficiary_member_id: string | null; amount: number; description: string; memo: string | null;
  include_in_budget: boolean; needs_review: boolean; status: string;
}): Transaction {
  return {
    id: row.id,
    householdId: row.household_id,
    transactionDate: row.transaction_date,
    transactionType: row.transaction_type as TransactionType,
    flowClass: row.flow_class,
    costBehavior: row.cost_behavior as 'fixed' | 'variable' | null,
    paymentMethodId: row.payment_method_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    payerMemberId: row.payer_member_id,
    beneficiaryMemberId: row.beneficiary_member_id,
    amount: row.amount,
    description: row.description,
    memo: row.memo,
    includeInBudget: row.include_in_budget,
    needsReview: row.needs_review,
    status: row.status as Transaction['status'],
  };
}

const TRANSACTION_COLUMNS =
  'id, household_id, transaction_date, transaction_type, flow_class, cost_behavior, ' +
  'payment_method_id, category_id, subcategory_id, payer_member_id, beneficiary_member_id, ' +
  'amount, description, memo, include_in_budget, needs_review, status';

export async function createTransaction(input: {
  householdId: string;
  transactionDate: string;
  transactionType: TransactionType;
  categoryId: string | null;
  categoryDefaultCostBehavior: 'fixed' | 'variable' | null;
  costBehaviorOverride?: 'fixed' | 'variable' | null;
  subcategoryId: string | null;
  paymentMethodId: string | null;
  amount: number;
  description: string;
  memo?: string | null;
  payerMemberId?: string | null;
  beneficiaryMemberId?: string | null;
  needsReview?: boolean;
}): Promise<Transaction> {
  if (input.amount <= 0) {
    throw new Error('금액은 0보다 커야 합니다.');
  }

  const supabase = await createClient();
  const costBehavior = resolveCostBehavior(
    input.transactionType,
    input.categoryDefaultCostBehavior,
    input.costBehaviorOverride ?? null,
  );

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      household_id: input.householdId,
      transaction_date: input.transactionDate,
      transaction_type: input.transactionType,
      flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[input.transactionType],
      cost_behavior: costBehavior,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      payment_method_id: input.paymentMethodId,
      payer_member_id: input.payerMemberId ?? null,
      beneficiary_member_id: input.beneficiaryMemberId ?? null,
      amount: input.amount,
      description: input.description,
      memo: input.memo ?? null,
      needs_review: input.needsReview ?? false,
      status: 'posted',
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) {
    throw new Error(`거래 생성 실패: ${error.message}`);
  }

  return mapRow(data);
}

export async function listTransactions(filter: {
  householdId: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Transaction[]> {
  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('household_id', filter.householdId)
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false });

  if (filter.fromDate) {
    query = query.gte('transaction_date', filter.fromDate);
  }
  if (filter.toDate) {
    query = query.lte('transaction_date', filter.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`거래 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const supabase = await createClient();
  // Soft delete only (PRD §5.4) — never a real SQL DELETE. See Task 2's migration note.
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`거래 삭제 실패: ${error.message}`);
  }
}
```

- [ ] **Step 6: Run full suite + build**

Run: `npm test && npm run build`
Expected: all pass, clean build.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: transaction data-access layer with cost-behavior resolution"
```

---

### Task 6: Mobile quick-add — real implementation

**Files:**
- Create: `src/actions/transaction-actions.ts`, `src/components/CategoryPicker.tsx`
- Modify: `src/app/(app)/quick-add/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `createTransaction` (Task 5), `listCategoriesWithSubcategories`/`listPaymentMethods` (Task 3), `ensureHouseholdForCurrentUser` (Sprint 0 Task 7).

- [ ] **Step 1: Transaction Server Action**

Create `src/actions/transaction-actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createTransaction } from '@/lib/transactions';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import type { TransactionType } from '@/lib/cost-behavior';

export async function createQuickTransactionAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();

  const amount = Number(formData.get('amount'));
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const categoryDefaultCostBehavior = (formData.get('categoryDefaultCostBehavior') || null) as
    'fixed' | 'variable' | null;
  const subcategoryId = String(formData.get('subcategoryId') ?? '') || null;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  const description = String(formData.get('description') ?? '').trim();
  const transactionType = (formData.get('transactionType') as TransactionType) ?? 'expense';

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('금액을 올바르게 입력해주세요.');
  }
  if (!description) {
    throw new Error('내용을 입력해주세요.');
  }

  await createTransaction({
    householdId: household.id,
    transactionDate: new Date().toISOString().slice(0, 10),
    transactionType,
    categoryId,
    categoryDefaultCostBehavior,
    subcategoryId,
    paymentMethodId,
    amount,
    description,
  });

  redirect('/quick-add?saved=1');
}
```

- [ ] **Step 2: Shared category/subcategory picker**

Create `src/components/CategoryPicker.tsx`:

```tsx
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
```

- [ ] **Step 3: Real quick-add page**

Replace `src/app/(app)/quick-add/page.tsx`:

```tsx
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { QuickAddForm } from './QuickAddForm';

export default async function QuickAddPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [categories, paymentMethods] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
  ]);

  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.isActive);
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">거래 기록</h1>
      <QuickAddForm categories={expenseCategories} paymentMethods={activePaymentMethods} />
    </div>
  );
}
```

Create `src/app/(app)/quick-add/QuickAddForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createQuickTransactionAction } from '@/actions/transaction-actions';
import { CategoryPicker } from '@/components/CategoryPicker';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function QuickAddForm({
  categories,
  paymentMethods,
}: {
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const [amountDisplay, setAmountDisplay] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithSubcategories | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  function handleAmountChange(raw: string) {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setAmountDisplay(digitsOnly ? Number(digitsOnly).toLocaleString('ko-KR') : '');
  }

  const numericAmount = amountDisplay.replace(/,/g, '');

  return (
    <form action={createQuickTransactionAction} className="flex flex-col gap-4">
      <input type="hidden" name="transactionType" value="expense" />
      <input type="hidden" name="categoryId" value={selectedCategory?.id ?? ''} />
      <input
        type="hidden"
        name="categoryDefaultCostBehavior"
        value={selectedCategory?.defaultCostBehavior ?? ''}
      />
      <input type="hidden" name="subcategoryId" value={selectedSubcategoryId ?? ''} />
      <input type="hidden" name="paymentMethodId" value={selectedPaymentMethodId ?? ''} />

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-600">금액</span>
        <input
          inputMode="numeric"
          autoFocus
          value={amountDisplay}
          onChange={(e) => handleAmountChange(e.target.value)}
          className="rounded border px-3 py-3 text-2xl"
          placeholder="0"
        />
        {/* real amount, digits only, submitted alongside the display value */}
        <input type="hidden" name="amount" value={numericAmount} />
      </label>

      <div>
        <span className="mb-1 block text-sm text-gray-600">대분류 / 소분류</span>
        <CategoryPicker
          categories={categories}
          onSelect={(category, subcategoryId) => {
            setSelectedCategory(category);
            setSelectedSubcategoryId(subcategoryId);
          }}
        />
      </div>

      <div>
        <span className="mb-1 block text-sm text-gray-600">결제수단</span>
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setSelectedPaymentMethodId(method.id)}
              className={`rounded border px-3 py-1 text-sm ${
                selectedPaymentMethodId === method.id ? 'bg-black text-white' : ''
              }`}
            >
              {method.name}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-600">내용</span>
        <input name="description" required className="rounded border px-3 py-2" />
      </label>

      <button type="button" onClick={() => setShowMore((v) => !v)} className="text-left text-sm text-gray-500">
        {showMore ? '접기' : '더보기 (명의자/비고/태그)'}
      </button>
      {showMore && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">비고</span>
          <input name="memo" className="rounded border px-3 py-2" />
        </label>
      )}

      <button type="submit" className="rounded bg-black px-4 py-3 text-lg text-white">
        저장
      </button>
    </form>
  );
}
```

> Note: this form's server action reads `formData.get('memo')` only if the `showMore` field was rendered — `createQuickTransactionAction` in Task 6 Step 1 doesn't yet read `memo` from the form; extend it to pass `memo: String(formData.get('memo') ?? '') || null` to `createTransaction` if you want the 더보기 field to actually persist (do this now, it's a one-line addition — don't leave a UI field that silently does nothing).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Log in, go to `/quick-add`, enter an amount, pick a category → subcategory, pick a payment method, enter a description, save. Confirm redirect to `/quick-add?saved=1` and that the transaction appears in the `transactions` table (Supabase Table Editor) with the correct `cost_behavior` copied from the category's `default_cost_behavior`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: real mobile quick-add flow (amount -> category -> payment method -> save)"
```

---

### Task 7: PC 월간관리 > 전체내역 tab

**Files:**
- Create: `src/app/(app)/monthly/AllTransactionsTab.tsx`
- Modify: `src/app/(app)/monthly/page.tsx` (replace placeholder with tab shell)

**Interfaces:**
- Consumes: `listTransactions` (Task 5), `listCategoriesWithSubcategories`/`listPaymentMethods` (Task 3).

- [ ] **Step 1: Tab shell**

Replace `src/app/(app)/monthly/page.tsx`:

```tsx
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions } from '@/lib/transactions';
import { AllTransactionsTab } from './AllTransactionsTab';

export default async function MonthlyPage() {
  const household = await ensureHouseholdForCurrentUser();
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const transactions = await listTransactions({ householdId: household.id, fromDate, toDate });

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">월간관리</h1>
      <p className="mb-4 text-sm text-gray-500">
        {fromDate} ~ {toDate} · 예산·결산/반복항목/월말점검 탭은 Sprint 2-3에서 추가됩니다.
      </p>
      <AllTransactionsTab initialTransactions={transactions} />
    </div>
  );
}
```

- [ ] **Step 2: All-transactions table**

Create `src/app/(app)/monthly/AllTransactionsTab.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/transactions';

const STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '건너뜀',
  cancelled: '취소',
};

export function AllTransactionsTab({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [statusFilter, setStatusFilter] = useState<Transaction['status'] | 'all'>('all');

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? initialTransactions
        : initialTransactions.filter((t) => t.status === statusFilter),
    [initialTransactions, statusFilter],
  );

  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['all', 'planned', 'posted', 'skipped', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded border px-2 py-1 text-sm ${statusFilter === status ? 'bg-black text-white' : ''}`}
          >
            {status === 'all' ? '전체' : STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">날짜</th>
              <th className="p-2">상태</th>
              <th className="p-2">내용</th>
              <th className="p-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((transaction) => (
              <tr key={transaction.id} className="border-b">
                <td className="p-2">{transaction.transactionDate}</td>
                <td className="p-2">{STATUS_LABEL[transaction.status]}</td>
                <td className="p-2">{transaction.description}</td>
                <td className="p-2 text-right">{transaction.amount.toLocaleString('ko-KR')}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-right text-sm font-medium">합계: {total.toLocaleString('ko-KR')}원</p>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification + build**

Run: `npm run build`. Confirm `/monthly` lists this month's transactions (including ones created via `/quick-add`), filterable by status, with a running total.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: PC 월간관리 전체내역 tab"
```

---

### Task 8: PC 월간관리 > 월간입력 tab (spreadsheet-style entry)

**Files:**
- Create: `src/app/(app)/monthly/MonthlyInputTab.tsx`
- Modify: `src/app/(app)/monthly/page.tsx` (add tab switcher between 월간입력/전체내역)

**Interfaces:**
- Consumes: `createTransaction` (Task 5, via a new Server Action), `@tanstack/react-table` (installed Sprint 0, unused until now).

- [ ] **Step 1: Row-add Server Action**

Add to `src/actions/transaction-actions.ts` (append, don't replace the existing export):

```ts
export async function createMonthlyRowAction(formData: FormData) {
  const household = await ensureHouseholdForCurrentUser();

  const amount = Number(formData.get('amount'));
  const transactionDate = String(formData.get('transactionDate') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const categoryDefaultCostBehavior = (formData.get('categoryDefaultCostBehavior') || null) as
    'fixed' | 'variable' | null;
  const subcategoryId = String(formData.get('subcategoryId') ?? '') || null;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;
  const transactionType = (formData.get('transactionType') as TransactionType) ?? 'expense';

  if (!transactionDate) {
    throw new Error('날짜를 입력해주세요.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('금액을 올바르게 입력해주세요.');
  }
  if (!description) {
    throw new Error('내용을 입력해주세요.');
  }

  await createTransaction({
    householdId: household.id,
    transactionDate,
    transactionType,
    categoryId,
    categoryDefaultCostBehavior,
    subcategoryId,
    paymentMethodId,
    amount,
    description,
  });
}
```

(Also add `import { revalidatePath } from 'next/cache';` at the top if not already present, and call `revalidatePath('/monthly')` at the end of this function so the table refreshes after a row is added.)

- [ ] **Step 2: Monthly input table**

Create `src/app/(app)/monthly/MonthlyInputTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { createMonthlyRowAction } from '@/actions/transaction-actions';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

const columnHelper = createColumnHelper<Transaction>();

const STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '건너뜀',
  cancelled: '취소',
};

const columns = [
  columnHelper.accessor('transactionDate', { header: '날짜' }),
  columnHelper.accessor('status', { header: '상태', cell: (info) => STATUS_LABEL[info.getValue()] }),
  columnHelper.accessor('description', { header: '내용' }),
  columnHelper.accessor('amount', {
    header: '금액',
    cell: (info) => `${info.getValue().toLocaleString('ko-KR')}원`,
  }),
];

export function MonthlyInputTab({
  initialTransactions,
  categories,
  paymentMethods,
}: {
  initialTransactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const table = useReactTable({
    data: initialTransactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const [categoryId, setCategoryId] = useState('');
  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={createMonthlyRowAction}
        className="grid grid-cols-2 gap-2 rounded border p-3 md:grid-cols-6"
      >
        <input type="hidden" name="transactionType" value="expense" />
        <input
          type="hidden"
          name="categoryDefaultCostBehavior"
          value={selectedCategory?.defaultCostBehavior ?? ''}
        />
        <input type="date" name="transactionDate" required className="rounded border px-2 py-1 text-sm" />
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">대분류</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="subcategoryId" className="rounded border px-2 py-1 text-sm">
          <option value="">소분류</option>
          {selectedCategory?.subcategories.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
        <select name="paymentMethodId" className="rounded border px-2 py-1 text-sm">
          <option value="">결제수단</option>
          {paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
        <input name="description" placeholder="내용" required className="rounded border px-2 py-1 text-sm" />
        <input name="amount" type="number" placeholder="금액" required className="rounded border px-2 py-1 text-sm" />
        <button type="submit" className="col-span-2 rounded bg-black px-3 py-1 text-sm text-white md:col-span-1">
          행 추가
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b text-left">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

> **Scope note:** this is a first-pass 월간입력 — a form-to-add-row plus a read table, not yet the full Excel-like experience PRD §5.3 describes (cell-level keyboard navigation, paste-multiple-rows, inline edit, previous-row-value copy). Those are explicitly deferred; log them as follow-ups rather than building them now, to keep this task's scope matched to its brief.

- [ ] **Step 3: Wire the tab switcher into the page**

Modify `src/app/(app)/monthly/page.tsx` to fetch categories/payment methods too and render a simple tab switcher between `MonthlyInputTab` and `AllTransactionsTab`:

```tsx
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { MonthlyPageTabs } from './MonthlyPageTabs';

export default async function MonthlyPage() {
  const household = await ensureHouseholdForCurrentUser();
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [transactions, categories, paymentMethods] = await Promise.all([
    listTransactions({ householdId: household.id, fromDate, toDate }),
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
  ]);

  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.isActive);
  const activePaymentMethods = paymentMethods.filter((m) => m.isActive);

  return (
    <div className="p-4">
      <h1 className="mb-1 text-xl font-semibold">월간관리</h1>
      <p className="mb-4 text-sm text-gray-500">
        {fromDate} ~ {toDate} · 예산·결산/반복항목/월말점검 탭은 Sprint 2-3에서 추가됩니다.
      </p>
      <MonthlyPageTabs
        transactions={transactions}
        categories={expenseCategories}
        paymentMethods={activePaymentMethods}
      />
    </div>
  );
}
```

Create `src/app/(app)/monthly/MonthlyPageTabs.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { MonthlyInputTab } from './MonthlyInputTab';
import { AllTransactionsTab } from './AllTransactionsTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function MonthlyPageTabs({
  transactions,
  categories,
  paymentMethods,
}: {
  transactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const [tab, setTab] = useState<'input' | 'all'>('input');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('input')}
          className={`px-3 py-2 text-sm ${tab === 'input' ? 'border-b-2 border-black font-medium' : 'text-gray-500'}`}
        >
          월간입력
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-3 py-2 text-sm ${tab === 'all' ? 'border-b-2 border-black font-medium' : 'text-gray-500'}`}
        >
          전체내역
        </button>
      </div>
      {tab === 'input' ? (
        <MonthlyInputTab initialTransactions={transactions} categories={categories} paymentMethods={paymentMethods} />
      ) : (
        <AllTransactionsTab initialTransactions={transactions} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual verification + build**

Run: `npm run build`. Confirm `/monthly` shows both tabs, adding a row via 월간입력 makes it appear in both tabs after a page refresh.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: PC 월간관리 월간입력 tab (TanStack Table, row-add form)"
```

---

### Task 9: RLS integration tests for the new tables

**Files:**
- Create: `tests/integration/rls-transactions.test.ts`

**Interfaces:**
- Consumes: same admin/anon client pattern as Sprint 0's `tests/integration/rls-households.test.ts`.

- [ ] **Step 1: Write the test**

Create `tests/integration/rls-transactions.test.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function randomTestEmail(label: string) {
  return `sprint1-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('categories/payment_methods/transactions RLS', () => {
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let userAId: string;
  let userBId: string;
  let userAHouseholdId: string;
  let userACategoryId: string;
  const userAEmail = randomTestEmail('a');
  const userBEmail = randomTestEmail('b');
  const password = 'Sprint1-Test-Password-1!';

  beforeAll(async () => {
    const { data: userAData, error: userAError } = await admin.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (userAError || !userAData.user) throw userAError ?? new Error('failed to create user A');
    userAId = userAData.user.id;

    const { data: userBData, error: userBError } = await admin.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (userBError || !userBData.user) throw userBError ?? new Error('failed to create user B');
    userBId = userBData.user.id;

    const { data: household, error: householdError } = await admin
      .from('households')
      .insert({ owner_user_id: userAId, name: 'A네 집' })
      .select('id')
      .single();
    if (householdError || !household) throw householdError ?? new Error('failed to create household');
    userAHouseholdId = household.id;
  });

  afterAll(async () => {
    const results = await Promise.allSettled(
      [userAId, userBId].filter((id): id is string => Boolean(id)).map((id) => admin.auth.admin.deleteUser(id)),
    );
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      console.error('RLS test cleanup failed for one or more users:', failures.map((f) => f.reason));
    }
  });

  it('lets user A create a category in their own household', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({ email: userAEmail, password });
    expect(signInError).toBeNull();

    const { data: category, error: categoryError } = await asUserA
      .from('categories')
      .insert({ household_id: userAHouseholdId, transaction_type: 'expense', name: '테스트 카테고리' })
      .select('id')
      .single();

    expect(categoryError).toBeNull();
    expect(category?.id).toBeTruthy();
    userACategoryId = category!.id;
  });

  it("hides user A's category from user B", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { data: selected, error: selectError } = await asUserB
      .from('categories')
      .select('id')
      .eq('id', userACategoryId);

    expect(selectError).toBeNull();
    expect(selected).toEqual([]);
  });

  it('blocks user B from inserting a transaction into A\'s household', async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserB.auth.signInWithPassword({ email: userBEmail, password });
    expect(signInError).toBeNull();

    const { error: insertError } = await asUserB.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      amount: 10000,
      description: '스푸핑 시도',
    });

    expect(insertError).not.toBeNull();
  });

  it('lets user A insert and read their own transaction, enforcing amount > 0', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({ email: userAEmail, password });
    expect(signInError).toBeNull();

    const { error: invalidAmountError } = await asUserA.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      amount: 0,
      description: '0원 거래 시도',
    });
    expect(invalidAmountError).not.toBeNull();

    const { data: inserted, error: insertError } = await asUserA
      .from('transactions')
      .insert({
        household_id: userAHouseholdId,
        transaction_date: '2026-08-28',
        transaction_type: 'expense',
        flow_class: 'consumption',
        category_id: userACategoryId,
        amount: 35000,
        description: '외식',
      })
      .select('id, amount, status')
      .single();

    expect(insertError).toBeNull();
    expect(inserted?.amount).toBe(35000);
    expect(inserted?.status).toBe('posted'); // default
  });
});
```

- [ ] **Step 2: Run test to verify it passes against the real linked project**

Run: `npm test -- rls-transactions.test.ts`
Expected: PASS — 4 tests (requires the same `.env.test.local` from Sprint 0 — already present).

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all tests pass (Sprint 0's + Sprint 1's).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: RLS coverage for categories/payment_methods/transactions"
```

---

## Self-Review Notes

- **Spec coverage:** §26 Sprint 1 bullets — categories/payment methods ✓ Tasks 1/3/4, mobile quick entry ✓ Task 6, transaction list ✓ Task 7, PC 월간입력 ✓ Task 8, planned/posted/skipped status ✓ schema (Task 2) + displayed in both tabs (Tasks 7/8), though nothing yet transitions a row to `planned` (that's Sprint 2's recurring engine — this sprint only ever inserts `posted`). §4's field list ✓ Task 2. §4.1 cost-behavior resolution ✓ Task 5. §5.1 mobile input order/progressive disclosure ✓ Task 6. §23.2 (카테고리 삭제 금지, inactive만) ✓ Task 1 (no delete policy) + Task 3 (`deactivateCategory`, never a delete call). §5.4 soft delete ✓ Task 2's note + Task 5's `softDeleteTransaction`.
- **Deferred with rationale:** full Excel-like PC grid UX (keyboard nav, paste, previous-row-copy) — Task 8's scope note explicitly defers this rather than silently shipping a lesser version and calling it done. Recurring/planned generation, budget aggregation, and dashboard KPIs are out of this plan entirely (Sprint 2/3), consistent with §26's own phase boundary.
- **Placeholder scan:** every step has runnable code; no "TBD"/"add appropriate handling" language.
- **Type consistency:** `Transaction`/`Category`/`CategoryWithSubcategories`/`PaymentMethod` types defined once each (Tasks 3/5) and imported, never redefined, across Tasks 4/6/7/8/9. `TransactionType` defined once in `cost-behavior.ts` and re-exported/imported everywhere else that needs it.
