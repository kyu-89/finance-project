# Sprint 1.5 — 이월 항목 정리 (Carry-over Cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the debts Sprint 0 and Sprint 1 deliberately deferred, before Sprint 2's recurring-transaction engine builds on top of them — repair the wrong `cost_behavior` data already in the database, harden the schema (tenant-consistency FK constraints, `updated_at` triggers, the `self`-member partial unique index), cover the two 정합성-critical invariants Sprint 1 shipped untested, make Server Action validation messages actually reach users, and finish PRD §4.2/§4.3/§5.1's unimplemented UX (category/subcategory editing, per-transaction 고정비/변동비 override, and the 속도 정책 block).

**Architecture:** Unchanged from Sprint 1 — Postgres + RLS, server-only data access in `src/lib/`, Server Actions in `src/actions/`, Client Components for interaction. Two structural shifts land here: (1) Server Actions move from `throw new Error(...)` to a `useActionState`-compatible `{ ok: false, message }` return shape, because Next.js redacts thrown Server Action messages in production; (2) schema invariants that were previously enforced only by app-layer discipline move into the database as constraints and triggers.

**Tech Stack:** Next.js 16.3.3 App Router (TypeScript strict) · Supabase Postgres + RLS · @tanstack/react-table v9 · Vitest

**Spec:** `docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md` — §4.1/§4.2 (비용 성격, 거래별 수정, 카테고리 기본값 변경), §4.3 (분류 CRUD), §5.1 (속도 정책: 최근사용 우선, 연속 입력, 토스트+Undo), §5.4 (soft delete), §21 (금액 우측정렬), §23 (정합성), §35 (고정비/변동비 규칙). Prior sprint plans' carry-over lists: `2026-08-28-sprint0-foundation.md`, `2026-08-28-sprint1-transactions.md` (its "Carried into Sprint 2" section is this plan's source of truth).

## Global Constraints

- TypeScript strict 모드를 유지한다(`tsconfig.json`의 `strict: true`). 새 타입 셋업 `.d.ts` 파일을 추가하지 않는다.
- 금액은 `bigint`(원 단위). float 금지. 정수만 허용한다.
- 모든 사용자 데이터 테이블은 RLS 활성화 + `auth.uid()` 기반 격리를 유지한다. 새 테이블/컬럼을 추가해도 이 원칙은 동일하다.
- `transactions`는 hard delete 금지 — DELETE 정책이 없으며(이미 제거됨), 삭제는 `deleted_at` UPDATE만 사용한다. `.delete()` 호출을 절대 추가하지 않는다.
- 카테고리/결제수단은 삭제하지 않고 `is_active = false`로 비활성화만 한다 (기존 거래의 FK가 끊기지 않도록). DELETE 정책을 추가하지 않는다. (§4.3, §23.2)
- `cost_behavior`는 거래 생성 시점에 스냅샷된다. 카테고리 기본값이 나중에 바뀌어도 과거 거래를 자동 변경하지 않는다 — 단, 이 스프린트의 Task 2는 **명시적 1회성 데이터 복구**이므로 예외이며, 그 사실을 마이그레이션에 기록한다. (§35)
- 저축/투자/대출원금/이체는 고정비·변동비 소비 분석에서 제외한다 — `cost_behavior`는 `expense`에만 non-null이다. (§35)
- 집계는 `flow_class`/`status`로 필터링한다. 무필터 합계를 노출하지 않는다. (§23)
- MVP라도 모바일/PC 반응형을 동시에 지원한다.
- 1차 메뉴는 `대시보드/월간관리/자산·금융/설정` 4개 — 새 1차 메뉴를 만들지 않는다.

---

## File Structure

```
supabase/migrations/
  20260830010000_schema_hardening.sql        (updated_at triggers, self-member partial unique index,
                                              tenant-consistency FK check trigger on transactions)
  20260830020000_repair_cost_behavior.sql    (one-time data repair: categories + existing transactions)
src/
  lib/
    action-result.ts        (shared ActionResult type + helpers for useActionState)
    categories.ts           (MODIFY: add updateCategory, subcategory CRUD, ordering determinism)
    transactions.ts         (MODIFY: add updateTransactionCostBehavior, listRecentUsage)
  actions/
    category-actions.ts     (MODIFY: return ActionResult instead of throwing; add update/subcategory actions)
    payment-method-actions.ts (MODIFY: return ActionResult)
    transaction-actions.ts  (MODIFY: return ActionResult; add undo + cost-behavior override actions)
  components/
    CategoryPicker.tsx      (MODIFY: subcategory selected state, recent-first ordering)
    FormMessage.tsx         (NEW: renders an ActionResult message consistently)
  app/(app)/
    settings/categories/
      page.tsx              (MODIFY: wire edit + subcategory management)
      CategoryEditor.tsx    (NEW: client component — edit name/cost-behavior, manage subcategories)
    settings/payment-methods/page.tsx (MODIFY: useActionState wiring)
    quick-add/QuickAddForm.tsx (MODIFY: useActionState, undo banner, 연속 입력)
    monthly/
      AllTransactionsTab.tsx (MODIFY: guard the 합계 by flow_class + status)
      MonthlyInputTab.tsx    (MODIFY: useActionState wiring, cost-behavior column)
tests/unit/
  flow-class.test.ts        (NEW: locks the transaction_type -> flow_class mapping)
  action-result.test.ts     (NEW)
tests/integration/
  rls-transactions.test.ts  (MODIFY: add soft-delete/deleted_at invariant + tenant-FK rejection tests)
```

---

### Task 1: Schema hardening — `updated_at` triggers, `self`-member uniqueness, tenant-consistency FK checks

**Files:**
- Create: `supabase/migrations/20260830010000_schema_hardening.sql`

**Interfaces:**
- Produces: a `public.set_updated_at()` trigger function + triggers on all 6 user tables; a partial unique index making a second `'self'` member impossible per household; a `public.transactions_tenant_check()` trigger rejecting cross-household FK references on `transactions`.

**Why now:** Sprint 2's recurring engine will write `transactions` rows programmatically at volume, including the FK columns this task constrains. Sprint 1's final review said explicitly: do this *before* that happens, not after.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260830010000_schema_hardening.sql`:

```sql
-- 1. updated_at maintenance -------------------------------------------------
-- Every table carries an updated_at column that nothing has ever updated, so it
-- has been permanently equal to created_at. Fix it once, centrally.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger subcategories_set_updated_at
  before update on public.subcategories
  for each row execute function public.set_updated_at();

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- 2. One 'self' member per household ----------------------------------------
-- Sprint 0's ensureSelfMember has a best-effort re-check because no DB constraint
-- could distinguish a concurrent-insert race from a real failure. A PARTIAL unique
-- index on member_type='self' fixes that without breaking PRD §3.1's multi-child
-- model (자녀1/자녀2 both legitimately have member_type='child').
create unique index household_members_one_self_per_household
  on public.household_members (household_id)
  where member_type = 'self';

-- 3. Tenant-consistency on transactions' cross-table FKs ---------------------
-- FK validation runs independently of RLS, so a caller who learns another household's
-- category/payment-method/member UUID could reference it from their own transaction.
-- No read leak results (the target row's own RLS still blocks reads), but it is a
-- referential-integrity crack that programmatic writers (Sprint 2's recurring engine)
-- could widen. Reject it at write time.
create or replace function public.transactions_tenant_check()
returns trigger
language plpgsql
as $$
declare
  mismatch_column text;
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.household_id = new.household_id
  ) then
    mismatch_column := 'category_id';
  elsif new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s
    join public.categories c on c.id = s.category_id
    where s.id = new.subcategory_id and c.household_id = new.household_id
  ) then
    mismatch_column := 'subcategory_id';
  elsif new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p
    where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then
    mismatch_column := 'payment_method_id';
  elsif new.payer_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.payer_member_id and m.household_id = new.household_id
  ) then
    mismatch_column := 'payer_member_id';
  elsif new.beneficiary_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.beneficiary_member_id and m.household_id = new.household_id
  ) then
    mismatch_column := 'beneficiary_member_id';
  elsif new.parent_transaction_id is not null and not exists (
    select 1 from public.transactions t
    where t.id = new.parent_transaction_id and t.household_id = new.household_id
  ) then
    mismatch_column := 'parent_transaction_id';
  end if;

  if mismatch_column is not null then
    raise exception
      'transactions.% references a row belonging to a different household', mismatch_column
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Also enforce that subcategory_id actually belongs to category_id when both are set —
-- a stale client select could otherwise pair them arbitrarily within one household.
create or replace function public.transactions_subcategory_check()
returns trigger
language plpgsql
as $$
begin
  if new.subcategory_id is not null and new.category_id is not null and not exists (
    select 1 from public.subcategories s
    where s.id = new.subcategory_id and s.category_id = new.category_id
  ) then
    raise exception 'transactions.subcategory_id does not belong to transactions.category_id'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger transactions_tenant_check_trigger
  before insert or update on public.transactions
  for each row execute function public.transactions_tenant_check();

create trigger transactions_subcategory_check_trigger
  before insert or update on public.transactions
  for each row execute function public.transactions_subcategory_check();
```

> **Note on `security definer`:** none of these functions use it (PRD §26 QA asks to minimize it). They run as the calling role, and every table they read is one the caller already has a SELECT policy for within their own household — a cross-household reference simply finds no row and is rejected, which is the intended outcome.

- [ ] **Step 2: [MANUAL — orchestrator] Push the migration**

```bash
npx supabase db push
```

Expected: `Applying migration 20260830010000_schema_hardening.sql...` then `Finished supabase db push.`

If the `household_members_one_self_per_household` index fails to create, it means an existing household already has two `'self'` rows (from Sprint 0's best-effort race window). Report that rather than dropping the constraint — the duplicate needs cleaning first.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260830010000_schema_hardening.sql
git commit -m "feat: schema hardening (updated_at triggers, self-member uniqueness, tenant-consistency FK checks)"
```

---

### Task 2: One-time data repair — wrong `cost_behavior` on seeded categories and their transactions

**Files:**
- Create: `supabase/migrations/20260830020000_repair_cost_behavior.sql`

**Why:** Sprint 1's plan hardcoded `default_cost_behavior = 'variable'` for every expense category except 저축성지출, contradicting PRD §4.1 (월세/관리비/보험료/통신 기본요금 → `fixed`). The seed code is fixed, but households seeded before that fix keep the wrong values — and because `cost_behavior` is snapshotted per transaction, every transaction already recorded under 주거비/보험비/통신비 is also wrong. This is the one place where retroactively rewriting a snapshot is correct, because the snapshot recorded a bug, not a user decision.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260830020000_repair_cost_behavior.sql`:

```sql
-- One-time repair. PRD §35 says a category's default_cost_behavior change must NOT
-- retroactively alter past transactions' snapshotted cost_behavior — that rule protects
-- deliberate user decisions. It does not apply here: these rows never reflected a user
-- decision, they reflect a seed bug (Sprint 1 stamped every expense category except
-- 저축성지출 as 'variable', contradicting PRD §4.1's own worked examples for
-- 월세/정액 관리비/보험료/통신 기본요금). Repairing them once is the whole point.
--
-- Scope is deliberately narrow: only the three category NAMES the seed got wrong, only
-- rows still holding the incorrect 'variable' value, and only transactions whose
-- cost_behavior still matches the (wrong) category default — a user who has since
-- overridden a transaction individually is left alone.

-- 1. Repair the category defaults themselves.
update public.categories
set default_cost_behavior = 'fixed'
where transaction_type = 'expense'
  and name in ('주거비', '보험비', '통신비')
  and default_cost_behavior is distinct from 'fixed';

-- 2. Repair transactions that inherited the wrong default.
--    Only expense rows, only ones currently 'variable', only ones whose category is now
--    'fixed' — i.e. exactly the rows that would have been 'fixed' had the seed been right.
update public.transactions t
set cost_behavior = 'fixed'
from public.categories c
where t.category_id = c.id
  and t.transaction_type = 'expense'
  and t.cost_behavior = 'variable'
  and c.default_cost_behavior = 'fixed'
  and c.name in ('주거비', '보험비', '통신비');
```

> **Note:** this migration runs as the migration role, so RLS does not filter it — that is intended and necessary (it must repair every household, not just one). It is also idempotent: re-running changes nothing, because both statements are guarded on the value they are about to write.

- [ ] **Step 2: [MANUAL — orchestrator] Push and verify the repair**

```bash
npx supabase db push
```

Then verify the repair actually applied, via the Supabase SQL editor or a throwaway query:

```sql
select name, default_cost_behavior
from public.categories
where transaction_type = 'expense' and name in ('주거비', '보험비', '통신비', '식비')
order by name;
```

Expected: 주거비/보험비/통신비 → `fixed`, 식비 → `variable`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260830020000_repair_cost_behavior.sql
git commit -m "fix: repair cost_behavior wrongly seeded as variable for 주거비/보험비/통신비"
```

---

### Task 3: Cover the two untested 정합성 invariants

**Files:**
- Create: `tests/unit/flow-class.test.ts`
- Modify: `src/lib/transactions.ts` (export `FLOW_CLASS_BY_TRANSACTION_TYPE` so it is testable)
- Modify: `tests/integration/rls-transactions.test.ts` (append soft-delete + tenant-FK cases)

**Why:** Sprint 1's final review flagged these as the two most 정합성-critical pieces shipped with zero coverage. Sprint 2's recurring engine writes `flow_class` programmatically at volume, so the map needs a guard before then — not after.

- [ ] **Step 1: Export the mapping so it can be tested**

In `src/lib/transactions.ts`, change the declaration from `const FLOW_CLASS_BY_TRANSACTION_TYPE` to `export const FLOW_CLASS_BY_TRANSACTION_TYPE`. Change nothing else.

- [ ] **Step 2: Write the flow-class test**

Create `tests/unit/flow-class.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FLOW_CLASS_BY_TRANSACTION_TYPE } from '@/lib/transactions';

// PRD §1.4 / §23.5 / §23.6: 현금이 나갔다고 모두 비용이 아니다. These assertions are the
// guard that keeps 저축/투자/대출원금/이체 out of 소비(consumption) as more code starts
// writing transactions programmatically (Sprint 2's recurring engine).
describe('FLOW_CLASS_BY_TRANSACTION_TYPE', () => {
  it('maps every transaction_type the DB CHECK constraint allows', () => {
    expect(Object.keys(FLOW_CLASS_BY_TRANSACTION_TYPE).sort()).toEqual(
      [
        'asset_adjustment',
        'debt_principal',
        'expense',
        'finance_cost',
        'income',
        'investment',
        'refund',
        'saving',
        'transfer',
      ].sort(),
    );
  });

  it('only ever emits flow_class values the DB CHECK constraint allows', () => {
    const allowed = new Set([
      'cash_in',
      'consumption',
      'saving',
      'investment',
      'debt_principal',
      'finance_cost',
      'transfer',
      'adjustment',
    ]);
    for (const flowClass of Object.values(FLOW_CLASS_BY_TRANSACTION_TYPE)) {
      expect(allowed.has(flowClass)).toBe(true);
    }
  });

  it('classifies only real consumption as consumption (PRD §23.5, §23.6)', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.expense).toBe('consumption');

    // The whole point of the flow_class axis: none of these are 소비.
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.saving).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.investment).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.debt_principal).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.transfer).not.toBe('consumption');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.finance_cost).not.toBe('consumption');
  });

  it('keeps 자산형성 components on their own distinct axes (PRD §1.4)', () => {
    // 자산형성액 = 저축 + 투자순유입 + 대출원금상환 — each must stay separable.
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.saving).toBe('saving');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.investment).toBe('investment');
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.debt_principal).toBe('debt_principal');
  });

  it('separates 금융비용 from both 소비 and 부채원금', () => {
    expect(FLOW_CLASS_BY_TRANSACTION_TYPE.finance_cost).toBe('finance_cost');
  });
});
```

- [ ] **Step 3: Run it**

Run: `npm test -- flow-class.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 4: Append integration cases for the soft-delete invariant and the new tenant checks**

Append these `it` blocks inside the existing `describe` in `tests/integration/rls-transactions.test.ts` (do NOT rewrite the file — the existing `beforeAll`/`afterAll` and `userAHouseholdId`/`userACategoryId` are reused):

```ts
  it('hides a soft-deleted transaction from its own owner (PRD §5.4)', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    const { data: inserted, error: insertError } = await asUserA
      .from('transactions')
      .insert({
        household_id: userAHouseholdId,
        transaction_date: '2026-08-28',
        transaction_type: 'expense',
        flow_class: 'consumption',
        category_id: userACategoryId,
        amount: 5000,
        description: '소프트 삭제 대상',
      })
      .select('id')
      .single();
    expect(insertError).toBeNull();

    // Visible before deletion.
    const { data: before } = await asUserA
      .from('transactions')
      .select('id')
      .eq('id', inserted!.id)
      .is('deleted_at', null);
    expect(before).toHaveLength(1);

    const { error: softDeleteError } = await asUserA
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', inserted!.id);
    expect(softDeleteError).toBeNull();

    // Gone from the app's read path...
    const { data: after } = await asUserA
      .from('transactions')
      .select('id')
      .eq('id', inserted!.id)
      .is('deleted_at', null);
    expect(after).toEqual([]);

    // ...but the row itself still exists, which is what makes 30-day recovery possible.
    const { data: stillThere } = await admin
      .from('transactions')
      .select('id, deleted_at')
      .eq('id', inserted!.id)
      .single();
    expect(stillThere?.id).toBe(inserted!.id);
    expect(stillThere?.deleted_at).not.toBeNull();
  });

  it("rejects a transaction referencing another household's category", async () => {
    // Build a second household owned by user B, with its own category.
    const { data: householdB, error: householdBError } = await admin
      .from('households')
      .insert({ owner_user_id: userBId, name: 'B네 집' })
      .select('id')
      .single();
    expect(householdBError).toBeNull();

    const { data: categoryB, error: categoryBError } = await admin
      .from('categories')
      .insert({ household_id: householdB!.id, transaction_type: 'expense', name: 'B의 카테고리' })
      .select('id')
      .single();
    expect(categoryBError).toBeNull();

    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    // User A inserts into their OWN household (so RLS permits it) but points category_id
    // at user B's category. RLS alone would allow this; the tenant-check trigger must not.
    const { error: crossTenantError } = await asUserA.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      category_id: categoryB!.id,
      amount: 1000,
      description: '교차 테넌트 FK 시도',
    });

    expect(crossTenantError).not.toBeNull();
  });

  it('rejects a subcategory that does not belong to the given category', async () => {
    const { data: otherCategory, error: otherCategoryError } = await admin
      .from('categories')
      .insert({ household_id: userAHouseholdId, transaction_type: 'expense', name: '다른 카테고리' })
      .select('id')
      .single();
    expect(otherCategoryError).toBeNull();

    const { data: otherSub, error: otherSubError } = await admin
      .from('subcategories')
      .insert({ category_id: otherCategory!.id, name: '다른 소분류' })
      .select('id')
      .single();
    expect(otherSubError).toBeNull();

    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    // Same household (so the tenant check passes) but the subcategory belongs to a
    // different category — the subcategory-consistency trigger must reject it.
    const { error: mismatchError } = await asUserA.from('transactions').insert({
      household_id: userAHouseholdId,
      transaction_date: '2026-08-28',
      transaction_type: 'expense',
      flow_class: 'consumption',
      category_id: userACategoryId,
      subcategory_id: otherSub!.id,
      amount: 1000,
      description: '소분류 불일치 시도',
    });

    expect(mismatchError).not.toBeNull();
  });
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass — 38 previous + 5 flow-class + 3 integration = 46.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: cover flow_class mapping, soft-delete invariant, and tenant-consistency triggers"
```

---

### Task 4: `ActionResult` — make Server Action validation messages reach users

**Files:**
- Create: `src/lib/action-result.ts`, `src/components/FormMessage.tsx`, `tests/unit/action-result.test.ts`
- Modify: `src/actions/category-actions.ts`, `src/actions/payment-method-actions.ts`, `src/actions/transaction-actions.ts`
- Modify: `src/app/(app)/settings/categories/page.tsx`, `src/app/(app)/settings/payment-methods/page.tsx`, `src/app/(app)/quick-add/QuickAddForm.tsx`, `src/app/(app)/monthly/MonthlyInputTab.tsx`

**Why:** All seven Server Actions currently signal failure by `throw new Error('금액을 올바르게 입력해주세요.')`. Next.js redacts thrown Server Action messages in production builds, so none of those Korean strings ever reaches a user — they get the generic error boundary and lose their input.

**Interfaces:**
- Produces: `type ActionResult = { ok: true } | { ok: false; message: string }`, `ok()`, `fail(message)`, `INITIAL_ACTION_STATE`. Every action's signature becomes `(prevState: ActionResult, formData: FormData) => Promise<ActionResult>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/action-result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fail, INITIAL_ACTION_STATE, ok } from '@/lib/action-result';

describe('ActionResult', () => {
  it('ok() produces a success result', () => {
    expect(ok()).toEqual({ ok: true });
  });

  it('fail() carries the user-facing message', () => {
    expect(fail('금액을 입력해주세요.')).toEqual({ ok: false, message: '금액을 입력해주세요.' });
  });

  it('the initial state is neither success nor failure so nothing renders on first paint', () => {
    expect(INITIAL_ACTION_STATE).toEqual({ ok: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- action-result.test.ts`
Expected: FAIL — `Cannot find module '@/lib/action-result'`.

- [ ] **Step 3: Implement `src/lib/action-result.ts`**

```ts
// Next.js redacts thrown Server Action error messages in production builds, so an action
// that signals failure by throwing gives the user a blank error page and no explanation.
// Returning a result instead keeps the message on the wire and lets useActionState render it.
export type ActionResult =
  | { ok: true }
  | { ok: false; message: string }
  | { ok: null };

export const INITIAL_ACTION_STATE: ActionResult = { ok: null };

export function ok(): ActionResult {
  return { ok: true };
}

export function fail(message: string): ActionResult {
  return { ok: false, message };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- action-result.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Shared message component**

Create `src/components/FormMessage.tsx`:

```tsx
import type { ActionResult } from '@/lib/action-result';

export function FormMessage({ result }: { result: ActionResult }) {
  if (result.ok === null) {
    return null;
  }

  if (result.ok) {
    return (
      <p
        role="status"
        className="rounded border border-green-500 bg-green-50 px-3 py-2 text-sm text-green-700"
      >
        저장되었습니다
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="rounded border border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {result.message}
    </p>
  );
}
```

- [ ] **Step 6: Convert every action to the result shape**

For each of the seven actions across the three files in `src/actions/`, apply the same mechanical transformation:

1. Add `import { fail, ok, type ActionResult } from '@/lib/action-result';`
2. Change the signature from `(formData: FormData)` to `(_prevState: ActionResult, formData: FormData): Promise<ActionResult>`
3. Replace every `throw new Error('...')` with `return fail('...')` — keep the exact same Korean message text
4. End the success path with `return ok();`
5. Wrap the data-layer call in `try { ... } catch (error) { return fail(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'); }` — the `src/lib/*` functions still throw, and those messages (e.g. `가구 조회 실패: ...`) are now worth surfacing too.

**Exception — `createQuickTransactionAction`:** it currently ends with `redirect('/quick-add?saved=...')`. Keep the redirect for the success path (Task 6 depends on it for the 연속 입력 reset) but note that `redirect()` throws internally, so it must be called *outside* the try/catch, after it, on the success path only. Structure it as:

```ts
export async function createQuickTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // ...validation, each failure `return fail(...)`

  try {
    await createTransaction({ /* ... */ });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '거래 저장에 실패했습니다.');
  }

  // Outside the try: redirect() signals by throwing, and catching it would break navigation.
  redirect(`/quick-add?saved=${Date.now()}`);
}
```

- [ ] **Step 7: Wire `useActionState` into each consuming form**

In each of the four consuming components, replace `<form action={someAction}>` with the `useActionState` pattern. For a Server Component page (`settings/categories/page.tsx`, `settings/payment-methods/page.tsx`), the form must move into a small `'use client'` child component, because `useActionState` is a client hook. Pattern:

```tsx
'use client';

import { useActionState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import { createPaymentMethodAction } from '@/actions/payment-method-actions';

export function PaymentMethodForm() {
  const [state, formAction, pending] = useActionState(createPaymentMethodAction, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <FormMessage result={state} />
      {/* ...existing fields unchanged... */}
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-1 text-white disabled:opacity-50">
        {pending ? '저장 중...' : '추가'}
      </button>
    </form>
  );
}
```

Apply the equivalent change to the categories form, the quick-add form, and the monthly-input form. Keep every existing field, class name, and Korean label exactly as it is — this task changes only how errors surface and adds a pending state.

- [ ] **Step 8: Verify**

Run: `npm run build && npm test && npm run lint`
Expected: all clean. Manually confirm in `npm run dev` that submitting the quick-add form with no category selected now shows the red `대분류를 선택해주세요.` message instead of crashing to the error boundary.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: surface Server Action validation messages via useActionState"
```

---

### Task 5: Category editing + subcategory CRUD

**Files:**
- Modify: `src/lib/categories.ts` (add `updateCategory`, `createSubcategory`, `updateSubcategory`, `deactivateSubcategory`, and ordering determinism)
- Modify: `src/actions/category-actions.ts` (add the matching actions)
- Create: `src/app/(app)/settings/categories/CategoryEditor.tsx`
- Modify: `src/app/(app)/settings/categories/page.tsx`

**Why:** PRD §4.2 requires "카테고리 관리에서 기본 비용성격을 변경할 수 있다" and §4.3 requires categories/subcategories be user-manageable. Today Settings offers only 추가/비활성화 on categories, and subcategories can only be created by the seed — so a user-added 대분류 can never have a 소분류. This is also the self-service path for repairing anything Task 2's migration doesn't cover.

- [ ] **Step 1: Add ordering determinism to the existing list function**

In `src/lib/categories.ts`'s `listCategoriesWithSubcategories`, change the query to break `display_order` ties and to order the nested subcategories (which currently have no ordering at all, so the picker buttons can reshuffle between renders):

```ts
  const { data, error } = await supabase
    .from('categories')
    .select(
      'id, household_id, transaction_type, name, default_cost_behavior, is_active, ' +
        'subcategories(id, category_id, name, is_active)',
    )
    .eq('household_id', householdId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
    .order('display_order', { referencedTable: 'subcategories', ascending: true })
    .order('name', { referencedTable: 'subcategories', ascending: true });
```

(Note: this `select` string must remain a single non-concatenated template literal or plain string if Supabase's type parser complains — Sprint 1 hit exactly that issue. If `+` concatenation breaks the build, join it into one literal.)

- [ ] **Step 2: Add the data-access functions**

Append to `src/lib/categories.ts`:

```ts
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
```

- [ ] **Step 3: Add the matching Server Actions**

Append to `src/actions/category-actions.ts`, following the `ActionResult` shape established in Task 4:

```ts
export async function updateCategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const raw = formData.get('defaultCostBehavior');
  const defaultCostBehavior = raw === 'fixed' || raw === 'variable' ? raw : null;

  if (!id) {
    return fail('카테고리 id가 없습니다.');
  }
  if (!name) {
    return fail('카테고리 이름을 입력해주세요.');
  }

  try {
    await updateCategory({ id, name, defaultCostBehavior });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '카테고리 수정에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function createSubcategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const categoryId = String(formData.get('categoryId') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!categoryId) {
    return fail('대분류를 선택해주세요.');
  }
  if (!name) {
    return fail('소분류 이름을 입력해주세요.');
  }

  try {
    await createSubcategory({ categoryId, name });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '소분류 생성에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function updateSubcategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!id) {
    return fail('소분류 id가 없습니다.');
  }
  if (!name) {
    return fail('소분류 이름을 입력해주세요.');
  }

  try {
    await updateSubcategory({ id, name });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '소분류 수정에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}

export async function deactivateSubcategoryAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return fail('소분류 id가 없습니다.');
  }

  try {
    await deactivateSubcategory(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '소분류 비활성화에 실패했습니다.');
  }

  revalidatePath('/settings/categories');
  return ok();
}
```

(Add the corresponding imports from `@/lib/categories` at the top of the file.)

- [ ] **Step 4: Build the editor UI**

Create `src/app/(app)/settings/categories/CategoryEditor.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { FormMessage } from '@/components/FormMessage';
import {
  createSubcategoryAction,
  deactivateSubcategoryAction,
  updateCategoryAction,
} from '@/actions/category-actions';
import type { CategoryWithSubcategories } from '@/lib/categories';

export function CategoryEditor({ category }: { category: CategoryWithSubcategories }) {
  const [expanded, setExpanded] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateCategoryAction, INITIAL_ACTION_STATE);
  const [subState, subAction, subPending] = useActionState(createSubcategoryAction, INITIAL_ACTION_STATE);
  const [deactivateState, deactivateAction] = useActionState(
    deactivateSubcategoryAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <div className="rounded border p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left text-sm font-medium"
      >
        {expanded ? '▾' : '▸'} [{category.transactionType === 'income' ? '수입' : '지출'}]{' '}
        {category.name}
        {category.defaultCostBehavior &&
          ` (${category.defaultCostBehavior === 'fixed' ? '고정비' : '변동비'})`}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-4">
          <form action={editAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <label className="flex flex-col gap-1 text-sm">
              이름
              <input
                name="name"
                defaultValue={category.name}
                required
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              기본 비용성격
              <select
                name="defaultCostBehavior"
                defaultValue={category.defaultCostBehavior ?? ''}
                className="rounded border px-2 py-1"
              >
                <option value="">(해당 없음)</option>
                <option value="fixed">고정비</option>
                <option value="variable">변동비</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={editPending}
              className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
            >
              {editPending ? '저장 중...' : '수정'}
            </button>
          </form>
          <FormMessage result={editState} />
          <p className="text-xs text-gray-500">
            기본 비용성격을 바꿔도 이미 기록된 거래는 변경되지 않습니다 (PRD §35).
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">소분류</span>
            <ul className="flex flex-col gap-1">
              {category.subcategories.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between text-sm">
                  <span className={sub.isActive ? '' : 'text-gray-400 line-through'}>{sub.name}</span>
                  {sub.isActive && (
                    <form action={deactivateAction}>
                      <input type="hidden" name="id" value={sub.id} />
                      <button type="submit" className="text-xs text-red-600">
                        비활성화
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <FormMessage result={deactivateState} />

            <form action={subAction} className="flex items-end gap-2">
              <input type="hidden" name="categoryId" value={category.id} />
              <input
                name="name"
                placeholder="새 소분류"
                required
                className="rounded border px-2 py-1 text-sm"
              />
              <button
                type="submit"
                disabled={subPending}
                className="rounded border px-2 py-1 text-sm disabled:opacity-50"
              >
                {subPending ? '추가 중...' : '추가'}
              </button>
            </form>
            <FormMessage result={subState} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Render the editor from the settings page**

In `src/app/(app)/settings/categories/page.tsx`, replace the read-only `<li>` rendering of each category with `<CategoryEditor key={category.id} category={category} />`, keeping the existing "add category" form and the deactivate-category form as they are.

- [ ] **Step 6: Verify**

Run: `npm run build && npm test && npm run lint`. In `npm run dev`, expand a category, change its 기본 비용성격, save, and confirm the change persists after a refresh. Add a subcategory to a category that had none and confirm it appears in `/quick-add`'s picker.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: category editing and subcategory CRUD in Settings"
```

---

### Task 6: PRD §5.1 속도 정책 — 최근사용 우선, 연속 입력, 5초 Undo

**Files:**
- Modify: `src/lib/transactions.ts` (add `listRecentUsage`, `undoTransaction`)
- Modify: `src/actions/transaction-actions.ts` (add `undoTransactionAction`; return the new id from quick-add)
- Modify: `src/app/(app)/quick-add/page.tsx`, `src/app/(app)/quick-add/QuickAddForm.tsx`, `src/components/CategoryPicker.tsx`

**Why:** PRD §5.1's 속도 정책 serves product goal G1 (10초 내 저장) and none of it shipped. The final review flagged this as a plan defect — the plan's own File Structure line even described `CategoryPicker.tsx` as a "recent-first" picker that no task ever asked anyone to build.

- [ ] **Step 1: Recent-usage query**

Append to `src/lib/transactions.ts`:

```ts
export type RecentUsage = {
  categoryIds: string[];
  subcategoryIdsByCategory: Record<string, string[]>;
  paymentMethodIds: string[];
};

// PRD §5.1 속도 정책: 최근 사용 대분류 5개를 상단 노출, 대분류 선택 시 최근 사용 소분류 우선 정렬,
// 최근 결제수단 자동 제안. Derived from the last N posted transactions rather than stored
// separately, so it needs no extra table and can never drift from the actual ledger.
export async function listRecentUsage(householdId: string, limit = 50): Promise<RecentUsage> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, subcategory_id, payment_method_id')
    .eq('household_id', householdId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`최근 사용 내역 조회 실패: ${error.message}`);
  }

  const categoryIds: string[] = [];
  const subcategoryIdsByCategory: Record<string, string[]> = {};
  const paymentMethodIds: string[] = [];

  for (const row of data ?? []) {
    if (row.category_id && !categoryIds.includes(row.category_id)) {
      categoryIds.push(row.category_id);
    }
    if (row.payment_method_id && !paymentMethodIds.includes(row.payment_method_id)) {
      paymentMethodIds.push(row.payment_method_id);
    }
    if (row.category_id && row.subcategory_id) {
      const list = (subcategoryIdsByCategory[row.category_id] ??= []);
      if (!list.includes(row.subcategory_id)) {
        list.push(row.subcategory_id);
      }
    }
  }

  return { categoryIds, subcategoryIdsByCategory, paymentMethodIds };
}

export async function undoTransaction(id: string): Promise<void> {
  // §5.1's 5초 Undo is just a soft delete — the row stays recoverable for 30 days
  // either way (§5.4), so "undo" and "delete" are the same operation here.
  await softDeleteTransaction(id);
}
```

- [ ] **Step 2: Return the created id so the client can undo it**

In `src/actions/transaction-actions.ts`, change `createQuickTransactionAction`'s success redirect to carry the new transaction's id alongside the save marker:

```ts
  let created;
  try {
    created = await createTransaction({ /* ...unchanged... */ });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '거래 저장에 실패했습니다.');
  }

  redirect(`/quick-add?saved=${Date.now()}&undo=${created.id}`);
```

And add the undo action:

```ts
export async function undoTransactionAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return fail('취소할 거래 id가 없습니다.');
  }

  try {
    await undoTransaction(id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '취소에 실패했습니다.');
  }

  redirect('/quick-add?undone=1');
}
```

- [ ] **Step 3: Sort the pickers by recent usage**

In `src/components/CategoryPicker.tsx`, accept an optional `recentUsage` prop and sort accordingly. Add to the props type and sort before rendering:

```tsx
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

  // Recent-first, stable for everything else (PRD §5.1). Categories not in the recent
  // list keep their existing display_order/name ordering from the query.
  const orderedCategories = [...categories].sort((a, b) => {
    const aRank = recentCategoryIds.indexOf(a.id);
    const bRank = recentCategoryIds.indexOf(b.id);
    if (aRank === bRank) return 0;
    if (aRank === -1) return 1;
    if (bRank === -1) return -1;
    return aRank - bRank;
  });

  const recentSubIds = selectedCategory
    ? (recentSubcategoryIdsByCategory[selectedCategory.id] ?? [])
    : [];
  const orderedSubcategories = selectedCategory
    ? [...selectedCategory.subcategories].sort((a, b) => {
        const aRank = recentSubIds.indexOf(a.id);
        const bRank = recentSubIds.indexOf(b.id);
        if (aRank === bRank) return 0;
        if (aRank === -1) return 1;
        if (bRank === -1) return -1;
        return aRank - bRank;
      })
    : [];
```

Then render `orderedCategories` / `orderedSubcategories` instead of the raw arrays, and give subcategory buttons a selected state (they currently have none, so the user cannot see which 소분류 they picked):

```tsx
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                setSelectedSubcategoryId(sub.id);
                onSelect(selectedCategory, sub.id);
              }}
              className={`rounded border px-2 py-1 text-xs ${
                selectedSubcategoryId === sub.id ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              {sub.name}
            </button>
```

Also reset `selectedSubcategoryId` to `null` inside the category button's `onClick`, so switching 대분류 clears the stale 소분류 highlight.

- [ ] **Step 4: Wire recent usage + the undo banner into quick-add**

In `src/app/(app)/quick-add/page.tsx`, fetch recent usage alongside the existing data and pass it plus the `undo` search param down:

```tsx
  const [categories, paymentMethods, recentUsage] = await Promise.all([
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
    listRecentUsage(household.id),
  ]);
```

Sort `activePaymentMethods` recent-first with the same comparator shape, then pass `recentCategoryIds={recentUsage.categoryIds}`, `recentSubcategoryIdsByCategory={recentUsage.subcategoryIdsByCategory}`, and `undoId={params.undo}` into `QuickAddForm`.

In `QuickAddForm.tsx`, replace the plain confirmation banner with one carrying an Undo button that disappears after 5 seconds:

```tsx
      {showSavedBanner && (
        <div className="flex items-center justify-between rounded border border-green-500 bg-green-50 px-3 py-2 text-sm text-green-700">
          <span>저장되었습니다</span>
          {undoId && (
            <form action={undoAction}>
              <input type="hidden" name="id" value={undoId} />
              <button type="submit" className="underline">
                실행취소
              </button>
            </form>
          )}
        </div>
      )}
```

The existing auto-hide `useEffect` already clears the banner — change its timeout from `3000` to `5000` to match §5.1's stated 5초 window, and keep the `key={saved ?? 'initial'}` remount so 연속 입력 starts from a clean form.

- [ ] **Step 5: Verify**

Run: `npm run build && npm test && npm run lint`. In `npm run dev`: save a transaction, confirm the 실행취소 button appears for 5 seconds, click it, and confirm the transaction disappears from `/monthly`. Save two transactions in a row and confirm the second entry starts from an empty form with the most-recently-used category listed first.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: PRD §5.1 속도 정책 — recent-first pickers, 연속 입력, 5초 Undo"
```

---

### Task 7: Per-transaction 고정비/변동비 override + guard the 월간관리 합계

**Files:**
- Modify: `src/lib/transactions.ts` (add `updateTransactionCostBehavior`)
- Modify: `src/actions/transaction-actions.ts` (add the action; read the override in the monthly-row action)
- Modify: `src/app/(app)/monthly/MonthlyInputTab.tsx` (add a 비용성격 column + selector), `src/app/(app)/monthly/AllTransactionsTab.tsx` (guard the total)
- Modify: `src/app/(app)/quick-add/QuickAddForm.tsx` (expose the override under 더보기)

**Why two things in one task:** both are small, both live in the same two monthly components, and both concern the same 정합성 axis (§35 cost behavior, §23 aggregation). Splitting them would mean two round-trips through the same files.

- [ ] **Step 1: Data-access function**

Append to `src/lib/transactions.ts`:

```ts
export async function updateTransactionCostBehavior(
  id: string,
  costBehavior: 'fixed' | 'variable' | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').update({ cost_behavior: costBehavior }).eq('id', id);

  if (error) {
    throw new Error(`비용성격 수정 실패: ${error.message}`);
  }
}
```

- [ ] **Step 2: Read the override where transactions are created**

In `createQuickTransactionAction` and `createMonthlyRowAction`, read an optional override from the form and pass it through (`createTransaction` already accepts `costBehaviorOverride` — nothing has ever supplied it):

```ts
  const rawCostBehavior = formData.get('costBehaviorOverride');
  const costBehaviorOverride =
    rawCostBehavior === 'fixed' || rawCostBehavior === 'variable' ? rawCostBehavior : null;
```

and add `costBehaviorOverride,` to the `createTransaction({ ... })` call in both.

- [ ] **Step 3: Add the standalone override action**

```ts
export async function updateCostBehaviorAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const raw = formData.get('costBehavior');
  const costBehavior = raw === 'fixed' || raw === 'variable' ? raw : null;

  if (!id) {
    return fail('거래 id가 없습니다.');
  }

  try {
    await updateTransactionCostBehavior(id, costBehavior);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '비용성격 수정에 실패했습니다.');
  }

  revalidatePath('/monthly');
  return ok();
}
```

- [ ] **Step 4: Expose the override in quick-add's 더보기**

Inside the `showMore` block in `QuickAddForm.tsx`, alongside the existing 비고 field:

```tsx
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">비용성격</span>
          <select name="costBehaviorOverride" className="rounded border px-3 py-2">
            <option value="">카테고리 기본값 사용</option>
            <option value="fixed">고정비</option>
            <option value="variable">변동비</option>
          </select>
        </label>
```

- [ ] **Step 5: Add a 비용성격 column to 월간입력**

In `MonthlyInputTab.tsx`, add a column to the TanStack Table definition (v9 API — `columnHelper.columns([...])`) between 상태 and 내용:

```ts
  columnHelper.accessor('costBehavior', {
    header: '비용성격',
    cell: (info) => {
      const value = info.getValue();
      return value === 'fixed' ? '고정비' : value === 'variable' ? '변동비' : '-';
    },
  }),
```

and add a matching `<select name="costBehaviorOverride">` to the add-row form (same options as Step 4).

- [ ] **Step 6: Guard the 합계 in 전체내역**

In `AllTransactionsTab.tsx`, the total currently sums every row's amount with no filter. Sprint 2's recurring engine will start creating `planned` rows and non-`consumption` flow classes, at which point an unguarded sum silently mixes 저축/이체/취소 into what reads as a spending total. Replace the single total with explicitly-labelled ones:

```tsx
  const postedConsumption = filtered.filter(
    (t) => t.status === 'posted' && t.flowClass === 'consumption',
  );
  const consumptionTotal = postedConsumption.reduce((sum, t) => sum + t.amount, 0);
  const plannedTotal = filtered
    .filter((t) => t.status === 'planned')
    .reduce((sum, t) => sum + t.amount, 0);
```

and render:

```tsx
      <div className="flex flex-col items-end gap-1 text-sm">
        <p className="font-medium">
          소비 합계 (확정): {consumptionTotal.toLocaleString('ko-KR')}원
        </p>
        {plannedTotal > 0 && (
          <p className="text-gray-500">
            예정 (실적 미포함): {plannedTotal.toLocaleString('ko-KR')}원
          </p>
        )}
      </div>
```

> PRD §23.9: `planned` 거래는 실제 실적/예산소진에 포함하지 않는다 — showing it separately, clearly labelled as excluded, is what that rule asks for.

- [ ] **Step 7: Verify**

Run: `npm run build && npm test && npm run lint`. In `npm run dev`, save a quick-add transaction with 비용성격 set to 고정비 on a 변동비-default category, and confirm the 월간입력 tab's 비용성격 column shows 고정비 for that row.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: per-transaction cost-behavior override; guard 전체내역 totals by flow_class and status"
```

---

## Self-Review Notes

- **Spec coverage:** §4.1 defaults corrected in data (Task 2) and guarded by the seed test from Sprint 1's fix wave. §4.2 per-transaction override ✓ Task 7, 카테고리 기본값 변경 ✓ Task 5. §4.3 subcategory CRUD ✓ Task 5. §5.1 속도 정책 (최근사용 우선/연속 입력/5초 Undo) ✓ Task 6 — note 명의자·태그 fields under 더보기 remain unimplemented (columns exist; no UI), carried forward. §5.4 soft-delete invariant now tested ✓ Task 3. §23.5/§23.6 flow_class separation now tested ✓ Task 3; §23.9 planned-excluded-from-실적 ✓ Task 7's guarded totals. §35 snapshot-not-retroactive preserved — Task 2 is an explicit, documented one-time exception for repairing a seed bug, and Task 5's editor states the rule to the user inline.
- **Deliberately NOT in this plan:** PRD §4.3's 15th expense category `용돈지출` (PRD supplies no subcategory list for it, and Task 5 now lets the user add it themselves with their own subcategories — better than guessing). 명의자/태그 quick-add fields. Excel-like grid UX (§5.3) — still Sprint 2+. Recurring rules, budgets, dashboards — Sprint 2/3 by design.
- **Ordering dependency:** Task 4 must land before Tasks 5–7, because those tasks' actions are written in the `ActionResult` shape Task 4 establishes. Tasks 1–3 are independent of that and can go in any order relative to each other.
- **Placeholder scan:** every step has runnable SQL, code, or an exact command.
- **Type consistency:** `ActionResult`/`ok`/`fail`/`INITIAL_ACTION_STATE` defined once (Task 4) and imported everywhere. `RecentUsage` defined once (Task 6). `CategoryWithSubcategories`, `Transaction`, `PaymentMethod` unchanged from Sprint 1 and reused as-is.
