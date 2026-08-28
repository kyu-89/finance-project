# Sprint 4 — 자산·금융 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the `자산·금융` menu's product masters — 계좌/카드, 예금, 적금, 대출, 보험, 기타자산 — with the PRD's exact calculation formulas covered by tests, plus 월별 자산 스냅샷 and 순자산 so the app can finally answer "우리 집 순자산이 얼마인가".

**Architecture:** Unchanged from Sprints 1–3. Postgres + RLS (household-scoped, `with check` on every INSERT/UPDATE, no DELETE policy — deactivate/soft-delete only), server-only data access in `src/lib/`, Server Actions returning `ActionResult`, Client Components for interaction. **Product calculations live in pure functions in `src/lib/` with no DB access**, so they are unit-testable against the PRD's stated values without touching Supabase — this is how §25's "Excel 검증값 일치" requirement gets met cheaply.

**Tech Stack:** Next.js 16.3.3 (App Router, TS strict) · Supabase Postgres + RLS · Vitest

**Spec:** `docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md` — §6.7 (예금 계산), §6.8 (적금 계산), §6.9 (대출 계산), §6.10 (순자산), §6.11 (자산 변동), §9 (자산 관리 전체), §10 (부채), §11 (보험), §20.7 (자산·금융 화면), §25 (테스트 기준), §26 Sprint 4.

**Scope note — 투자 is deliberately NOT in this sprint.** PRD §2.2 places 투자 거래 및 수익 집계 in **Phase 1.5**, not MVP, and §14's 업비트 model needs its own design pass. The `자산·금융 > 투자` tab is left as a placeholder. Do not build it here.

## Global Constraints

- 금액은 `bigint`(원 단위), 정수만. float 금지. 금리/비율은 `numeric(10,6)`. (§3.2)
- 모든 신규 테이블 RLS 활성화 + `households.owner_user_id = auth.uid()` 스코프. 모든 INSERT/UPDATE 정책에 `with check` 필수. (§0.6, §16.2)
- 삭제 정책을 만들지 않는다 — 상품은 상태 전이(`active`/`closed`/`matured` 등)로 관리한다. 기존 거래의 FK가 끊기면 안 된다. (§23.2)
- 교차 가구 FK를 막는 tenant-check 트리거를 신규 테이블에도 적용한다. **안전성은 RLS 가시성이 아니라 명시적 `= new.household_id` 술어에서 나온다** — `20260830010000_schema_hardening.sql`의 주석 참조. (§27)
- 새 함수에 `security definer`를 쓰지 않는다. RPC가 필요하면 `security invoker`로 만들고 호출자 RLS로 읽은 행에서 household를 유도한다. (§26 QA)
- 계산은 화면이 아니라 공용 순수 함수에서 한다. 화면별로 수식을 중복 구현하지 않는다. (§26 재무 집계 QA)
- 계좌번호는 기본 마스킹(`****-****-1234`), 전체 표시는 상세에서만. (§9.1, §16.2)
- 자산 스냅샷은 저장 시점 값을 보존한다 — 이후 상품값이 바뀌어도 과거 스냅샷을 소급 변경하지 않는다. (§9.6, §23.13)
- 날짜는 `src/lib/date.ts`의 `todayInSeoul()` 등을 쓴다. `new Date().toISOString().slice(0,10)`을 새로 쓰지 않는다 (Sprint 1에서 이미 한 번 회귀했음).
- TypeScript `strict: true` 유지, 타입 shim `.d.ts` 추가 금지.
- 1차 메뉴 4개 고정. 모든 신규 화면은 `자산·금융` 탭 내부에 들어간다. (§19.1)

---

## File Structure

```
supabase/migrations/
  20260902010000_recurring_ended_lock.sql      (Task 1: review fix — DB-level terminal state)
  20260902020000_accounts_and_cards.sql        (Task 2)
  20260902030000_deposits_and_savings.sql      (Task 4)
  20260902040000_loans_and_insurances.sql      (Task 6)
  20260902050000_assets_and_snapshots.sql      (Task 8)
src/lib/
  deposit-calculations.ts    (Task 3 — pure, PRD §6.7)
  savings-calculations.ts    (Task 3 — pure, PRD §6.8)
  loan-calculations.ts       (Task 5 — pure, PRD §6.9)
  net-worth.ts               (Task 8 — pure, PRD §6.10/§6.11)
  accounts.ts / cards.ts / deposits.ts / savings.ts / loans.ts / insurances.ts / assets.ts / snapshots.ts
src/actions/
  account-actions.ts / deposit-actions.ts / savings-actions.ts / loan-actions.ts /
  insurance-actions.ts / asset-actions.ts / snapshot-actions.ts
src/app/(app)/finance/
  page.tsx            (전체 탭 — 총자산/총부채/순자산 + 구성)
  accounts/page.tsx   (계좌·카드)
  savings/page.tsx    (예·적금)
  loans/page.tsx      (대출)
  insurances/page.tsx (보험)
  assets/page.tsx     (기타자산)
tests/unit/
  deposit-calculations.test.ts / savings-calculations.test.ts /
  loan-calculations.test.ts / net-worth.test.ts
tests/integration/
  rls-finance.test.ts
```

---

### Task 1: Carry over the Sprint 2/3 review findings

**Files:**
- Create: `supabase/migrations/20260902010000_recurring_ended_lock.sql`
- Modify: `tests/integration/rls-transactions.test.ts`

**Why here:** Sprint 2/3's post-hoc review found three Important issues. They are small and touch code Sprint 4 builds on, so they land first rather than becoming their own cycle.

- [ ] **Step 1: Make the terminal `ended` state actually terminal**

The review found `update_recurring_rule_status` raises on reactivation, but nothing stops a direct PostgREST `PATCH` from setting `status='active'` on an owned ended rule — after which `materializeRecurringRulesForRange` starts generating occurrences again. The RPC-level guard is not a database guarantee, despite its comment claiming it stops direct SDK callers.

Create `supabase/migrations/20260902010000_recurring_ended_lock.sql`:

```sql
-- 20260831070000 documented the `ended` status as terminal and unreachable by "direct SDK/RPC
-- callers", but implemented the guard only inside update_recurring_rule_status. The UPDATE policy
-- permits any column change on an owned row, so a plain PostgREST PATCH could revive an ended
-- rule and restart occurrence generation. Move the guarantee into the table, where the comment
-- always claimed it was.
create or replace function public.recurring_rules_ended_is_terminal()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'ended' and new.status is distinct from 'ended' then
    raise exception '종료된 반복규칙은 다시 활성화할 수 없습니다'
      using errcode = 'check_violation';
  end if;

  -- An ended rule's schedule and base amount are historical record: freezing them keeps past
  -- posted transactions interpretable against the rule that produced them (§5.5.4).
  if old.status = 'ended' and (
    new.default_amount is distinct from old.default_amount
    or new.frequency is distinct from old.frequency
    or new.interval_count is distinct from old.interval_count
    or new.monthly_day is distinct from old.monthly_day
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
  ) then
    raise exception '종료된 반복규칙의 일정·금액은 변경할 수 없습니다'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger recurring_rules_ended_is_terminal_trigger
  before update on public.recurring_rules
  for each row execute function public.recurring_rules_ended_is_terminal();
```

> Before writing this, **read `supabase/migrations/20260831010000_recurring_engine.sql` and confirm the actual column names** (`interval_count`, `monthly_day`, `default_amount`, `start_date`, `end_date`). If any differ, use the real ones — a trigger referencing a nonexistent column fails at `db push`, not silently.

- [ ] **Step 2: [MANUAL — orchestrator] Push**

```bash
npx supabase db push
```

- [ ] **Step 3: Fix the vacuously-passing tests**

In `tests/integration/rls-transactions.test.ts`, the review identified cross-user probes that follow an **unasserted** `signInWithPassword` — around lines 539-547 and 636-641, plus unasserted user-A sign-ins at ~458, 491, 509, 552, 595. Because every policy is `to authenticated` with no `anon` grants, a silently-failed sign-in makes the isolation assertion pass as an anon-role denial, proving nothing.

Add `expect(signInError).toBeNull();` immediately after **every** `signInWithPassword` in the file, destructuring `{ error: signInError }` where the result is currently discarded. Line numbers may have shifted — find them by searching for `signInWithPassword`.

- [ ] **Step 4: Add the three missing invariant tests**

Append to the same file's existing `describe` (reusing its `admin`/`beforeAll`/`afterAll`):

1. **DELETE is denied on the Sprint 2/3 tables.** For `recurring_rules` and `budgets`: as the owning user, insert a row, attempt `.delete().eq('id', ...)`, assert it removed nothing (`data: []` / row still present via `admin`), mirroring the existing transactions delete test.
2. **Cross-household child attach is rejected.** As user A, attempt to insert a `recurring_occurrences` row whose `recurring_rule_id` belongs to user B's household — assert a non-null error (the tenant-check trigger must fire).
3. **`link_recurring_occurrence` cannot bridge households.** As user A, call it with a `p_posted_transaction_id` belonging to household B — assert it errors. (The existing test passes *all* of A's ids as user B, which dies at the first RLS-filtered lookup; this is the untested direction.)

- [ ] **Step 5: Verify and commit**

```bash
npm run build && npm run lint && npx vitest run tests/unit
npm test   # full suite once — allow ~60s since the last integration run, Supabase auth rate-limits back-to-back sign-ins
git add -A && git commit -m "fix: enforce terminal recurring state in DB; close review gaps in RLS tests"
```

---

### Task 2: 계좌 / 카드 schema + data access + UI

**Files:**
- Create: `supabase/migrations/20260902020000_accounts_and_cards.sql`, `src/lib/accounts.ts`, `src/lib/cards.ts`, `src/actions/account-actions.ts`, `src/app/(app)/finance/accounts/page.tsx` (+ its client form components)
- Modify: `src/app/(app)/finance/page.tsx` (link to the new tab)

**Interfaces produced:** `listAccounts(householdId)`, `createAccount(input)`, `updateAccountBalance(id, amount)`, `closeAccount(id)`; same shape for cards. `maskAccountNumber(full: string): string`.

- [ ] **Step 1: Migration**

Model PRD §9.1 (은행/종류/계좌명/계좌번호/용도/현재금액/명의자/비고) and §9.2 (카드사/유형/발급처/카드명/연회비/해지가능월/실질혜택/명의자/상태/비고). Follow the established pattern exactly — copy the shape of `20260901010000_budgets.sql`'s policies and tenant-check trigger, substituting the new tables.

```sql
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bank_name text not null,
  account_type text not null default 'checking'
    check (account_type in ('checking', 'savings', 'cma', 'other')),
  account_name text not null,
  account_number text null,
  purpose text null,
  current_balance bigint not null default 0,
  owner_member_id uuid null references public.household_members (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  issuer text not null,
  card_type text not null check (card_type in ('credit', 'check')),
  card_name text not null,
  annual_fee bigint not null default 0,
  cancellable_from date null,
  closed_at date null,
  benefit_summary text null,
  owner_member_id uuid null references public.household_members (id) on delete set null,
  payment_method_id uuid null references public.payment_methods (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Then, for **both** tables: `enable row level security`; SELECT/INSERT/UPDATE policies household-scoped with `with check`; **no DELETE policy**; `set_updated_at` triggers; and a tenant-check trigger validating `owner_member_id` (and `payment_method_id` for cards) against `new.household_id` using the explicit-predicate idiom.

- [ ] **Step 2: [MANUAL — orchestrator] `npx supabase db push`**

- [ ] **Step 3: Masking helper with a test**

Create `src/lib/mask.ts`:

```ts
// PRD §9.1/§16.2: 계좌번호 UI 기본 마스킹. Keep the last 4 digits so the user can still tell
// their accounts apart, mask everything before it, and preserve the original separators.
export function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber) {
    return '';
  }
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length <= 4) {
    return accountNumber;
  }
  const visible = digits.slice(-4);
  let masked = '';
  let digitsSeen = 0;
  for (const char of accountNumber) {
    if (/\d/.test(char)) {
      digitsSeen += 1;
      masked += digitsSeen > digits.length - 4 ? char : '*';
    } else {
      masked += char;
    }
  }
  return masked || `****${visible}`;
}
```

Create `tests/unit/mask.test.ts` asserting: `'123-456-789012'` → `'***-***-****9012'`; `null` → `''`; `'1234'` → `'1234'` (too short to mask); a number with no separators masks all but the last four.

- [ ] **Step 4: Data access + actions + UI**

`src/lib/accounts.ts` / `cards.ts` follow the exact shape of `src/lib/budgets.ts` (server-only, throw on error with a Korean message). Actions follow the `ActionResult` pattern with `revalidatePath('/finance/accounts')`. The page lists accounts with **masked** numbers and a per-row balance-update form, plus a card list. Use the existing Toss-style primitives (`tds-chip`, `.tds-card` etc. — read `src/app/globals.css` for what exists rather than inventing classes).

- [ ] **Step 5: Verify + commit**

`npm run build && npm run lint && npx vitest run tests/unit`, then commit.

---

### Task 3: 예금·적금 계산 (pure functions, TDD)

**Files:** Create `src/lib/deposit-calculations.ts`, `src/lib/savings-calculations.ts`, `tests/unit/deposit-calculations.test.ts`, `tests/unit/savings-calculations.test.ts`

**Why pure + TDD:** PRD §25 requires "Excel과 동일 입력값에서 세전/세후/예상수령액 비교" and "월복리 FV 결과 일치(반올림 규칙 포함)". Keeping these DB-free makes that verifiable in milliseconds.

- [ ] **Step 1: Write the deposit tests FIRST (§6.7)**

```ts
import { describe, expect, it } from 'vitest';
import {
  classifyTermLength,
  monthsBetween,
  calculateDeposit,
} from '@/lib/deposit-calculations';

describe('monthsBetween', () => {
  it('counts whole months between two dates', () => {
    expect(monthsBetween('2026-01-01', '2027-01-01')).toBe(12);
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(0); // not yet a full month
    expect(monthsBetween('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('classifyTermLength', () => {
  // PRD §6.7 keeps Excel's original boundaries verbatim, including the odd 36/37 gap:
  // 37개월 초과 장기 / 36개월 미만 단기 / 그 외 중기.
  it('applies the PRD boundaries exactly', () => {
    expect(classifyTermLength(38)).toBe('long');
    expect(classifyTermLength(35)).toBe('short');
    expect(classifyTermLength(36)).toBe('mid');
    expect(classifyTermLength(37)).toBe('mid');
  });
});

describe('calculateDeposit', () => {
  it('computes 세전/세후 이자 and 예상수령액 (PRD §6.7)', () => {
    // 원금 10,000,000 · 연이율 3.5% · 12개월 · 과세율 15.4%
    const result = calculateDeposit({
      principal: 10_000_000,
      annualRate: 0.035,
      termMonths: 12,
      taxRate: 0.154,
    });
    // 세전 = 10,000,000 × 0.035 × (12/12) = 350,000
    expect(result.pretaxInterest).toBe(350_000);
    // 세후 = 350,000 × (1 - 0.154) = 296,100
    expect(result.aftertaxInterest).toBe(296_100);
    expect(result.maturityAmount).toBe(10_296_100);
  });

  it('prorates by 가입개월/12 for non-annual terms', () => {
    const result = calculateDeposit({
      principal: 10_000_000,
      annualRate: 0.03,
      termMonths: 6,
      taxRate: 0,
    });
    expect(result.pretaxInterest).toBe(150_000); // 10,000,000 × 0.03 × 0.5
  });

  it('rounds to whole 원 (금액은 정수)', () => {
    const result = calculateDeposit({
      principal: 1_000_000,
      annualRate: 0.033,
      termMonths: 7,
      taxRate: 0.154,
    });
    expect(Number.isInteger(result.pretaxInterest)).toBe(true);
    expect(Number.isInteger(result.aftertaxInterest)).toBe(true);
    expect(Number.isInteger(result.maturityAmount)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (`npx vitest run tests/unit/deposit-calculations.test.ts`)

- [ ] **Step 3: Implement `src/lib/deposit-calculations.ts`**

```ts
export type TermLength = 'short' | 'mid' | 'long';

export type DepositInput = {
  principal: number;
  annualRate: number; // 0.035 = 3.5%
  termMonths: number;
  taxRate: number; // 0.154 = 15.4%
};

export type DepositResult = {
  pretaxInterest: number;
  aftertaxInterest: number;
  maturityAmount: number;
};

// Whole months elapsed; a partial month does not count (Excel's DATEDIF "m" behaviour).
export function monthsBetween(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) {
    months -= 1;
  }
  return Math.max(0, months);
}

// PRD §6.7 preserves Excel's original thresholds verbatim, 36/37 gap included. The PRD flags
// them as unintuitive and says the UI may make them configurable later — do not "fix" them here.
export function classifyTermLength(termMonths: number): TermLength {
  if (termMonths > 37) return 'long';
  if (termMonths < 36) return 'short';
  return 'mid';
}

export function calculateDeposit(input: DepositInput): DepositResult {
  const pretaxInterest = Math.round(input.principal * input.annualRate * (input.termMonths / 12));
  const aftertaxInterest = Math.round(pretaxInterest * (1 - input.taxRate));
  return {
    pretaxInterest,
    aftertaxInterest,
    maturityAmount: input.principal + aftertaxInterest,
  };
}
```

- [ ] **Step 4: Confirm GREEN**

- [ ] **Step 5: 적금 tests then implementation (§6.8)**

Write `tests/unit/savings-calculations.test.ts` first, covering both methods:

- 만기 원금 = 월 적립액 × 가입개월
- **단리** 세전이자 = 월적립액 × [개월 × (개월+1) / 2] × (연이율/12). Assert a concrete case: 월 500,000 · 12개월 · 연 3% → 500,000 × 78 × 0.0025 = **97,500**.
- **월복리** 세전이자 = 월복리 미래가치 − 납입원금, where FV of an ordinary annuity is `PMT × ((1+i)^n − 1) / i` with `i = annualRate/12`. Assert it is **greater than** the 단리 result for the same inputs, and assert a specific rounded value you compute from that formula.
- 세후이자 = 세전 × (1 − 과세율); 예상수령액 = 만기원금 + 세후이자.
- All outputs integers.

Then implement `src/lib/savings-calculations.ts` with `calculateSavings({ monthlyAmount, annualRate, termMonths, taxRate, method: 'simple' | 'monthly_compound' })`.

- [ ] **Step 6: Commit**

---

### Task 4: 예금·적금 schema + UI

**Files:** Create `supabase/migrations/20260902030000_deposits_and_savings.sql`, `src/lib/deposits.ts`, `src/lib/savings.ts`, `src/actions/deposit-actions.ts`, `src/actions/savings-actions.ts`, `src/app/(app)/finance/savings/page.tsx` (+ client components)

- [ ] **Step 1: Migration**

`deposits`: 은행/예금명/가입일/만기일/원금(`bigint`)/이율(`numeric(10,6)`)/과세율(`numeric(10,6)`)/명의자/비고/상태(`active|matured|terminated`)/출금계좌(`account_id`).
`savings_accounts`: 은행/적금명/가입일/만기일/월적립액/이율/과세율/방식(`simple|monthly_compound`)/현재저축액/월납부일/출금계좌/**반복납입 활성여부**(`auto_recurring boolean`)/명의자/비고/상태.

Same RLS + `with check` + no-DELETE + tenant-check-trigger pattern. `savings_accounts.auto_recurring` and `monthly_payment_day` are what Task 7 reads to link products to the recurring engine.

**Do not store 계산 결과** (세전이자/세후이자/예상수령액/기간분류/남은기간). Those are derived by Task 3's pure functions at read time — §0.4 forbids persisting aggregates that can drift from source data.

- [ ] **Step 2: [MANUAL — orchestrator] `npx supabase db push`**

- [ ] **Step 3–5: Data access, actions, UI**

The 예·적금 page lists both, showing derived 기간분류/남은기간/세전이자/세후이자/예상수령액 computed via Task 3's functions. Verify, commit.

---

### Task 5: 대출 계산 (pure functions, TDD)

**Files:** Create `src/lib/loan-calculations.ts`, `tests/unit/loan-calculations.test.ts`

- [ ] **Step 1: Tests first (§6.9, §25)**

Cover:
- `buildAmortizationSchedule` for **원리금균등** (equal total payment): monthly payment = `P × i × (1+i)^n / ((1+i)^n − 1)`. Assert the final 대출잔금 lands on **0** (within 1원 of rounding) — a schedule that doesn't fully amortise is the classic bug here.
- **원금균등** (equal principal): 납입원금 constant, 이자 decreasing, 잔금 decreasing linearly to 0.
- 거치기간(개월) — interest-only for the first N months, principal untouched, then amortisation over the remaining term.
- 월상환금 = 납입원금 + 대출이자 for every row; 누적상환금 monotonically increasing; 대출잔금 = 이전 잔금 − 납입원금.
- `findCurrentSnapshot(schedule, today)` — PRD §6.9's `VLOOKUP(TODAY(), 상환표)` means **"오늘 이하 가장 최근 상환건"**. Assert: a date before the first payment yields `null` (not the first row); a date exactly on a payment date yields that row; a date between payments yields the earlier one.
- All amounts integers.

- [ ] **Step 2: RED → implement → GREEN → commit**

Implement `src/lib/loan-calculations.ts` exporting `buildAmortizationSchedule(input)`, `findCurrentSnapshot(schedule, isoDate)`, and `summarizeLoan(schedule)` (총 이자, 총 상환액).

---

### Task 6: 대출 + 보험 schema, data access, UI

**Files:** Create `supabase/migrations/20260902040000_loans_and_insurances.sql`, `src/lib/loans.ts`, `src/lib/insurances.ts`, actions, `src/app/(app)/finance/loans/page.tsx`, `src/app/(app)/finance/insurances/page.tsx`

- [ ] **Step 1: Migration**

`loans` (§10.1): 기관명/대출명/최초대출금액/연이자율/상환방법(`equal_payment|equal_principal|bullet`)/대출일/만기일/거치기간개월/상태(`active|paid_off|refinanced`)/명의자/비고.
`loan_payments` (§10.2): loan_id/회차/상환일/납입원금/대출이자/월상환금/누적상환금/대출잔금/`payment_type`(`scheduled|early|refinance|payoff`)/비고. **§10.2 requires 조기상환/대환 be structured, not a memo field.**
`insurances` (§11): 상태(`active|terminated|free`)/피보험자(`insured_member_id`)/보험사/종류/보험명/보장내역/납부방법/가입일/납입만기/보험만기/월보험료/연락처/비고/**월납부일**/결제수단.

Same RLS pattern throughout. `insurances.monthly_premium` + `payment_day` + `status` are Task 7's inputs.

- [ ] **Step 2: [MANUAL — orchestrator] `npx supabase db push`**

- [ ] **Step 3–5: Data access, actions, UI.** The loan page shows the generated schedule and the **current** 누적상환금/대출잔금 via `findCurrentSnapshot`. Verify, commit.

---

### Task 7: 상품 ↔ 반복거래 연계

**Files:** Modify `src/lib/recurring-rules.ts`, the savings/insurance/loan data-access modules, and their UIs.

**Why:** PRD §5.6 and §26's "반복거래와 상품잔액 연계" — the whole point of Sprint 2's engine is that 보험료/적금/대출 stop being retyped monthly.

- [ ] **Step 1: Create rules from products**

Add `createRecurringRuleFromProduct({ sourceType, sourceId, ... })` covering §5.6:
- **보험** `status='active'` + 월보험료 + 납부일 → monthly `expense` planned rule
- **적금** `auto_recurring=true` + 월적립액 + 납부일 → monthly `saving` planned rule (`flow_class='saving'`, **NOT** `consumption` — §23.6)
- **대출** with a schedule → monthly rule; the generated transaction must split 원금 vs 이자 into **separate** rows (`debt_principal` and `finance_cost`), never one combined 소비 row (§5.6 대출, §23.7)
- 거치식 예금 (no monthly payment) generates **nothing** (§5.6 예금)

`recurring_rules.source_type` / `source_id` already exist. **Add `source_id` to `recurring_rule_tenant_check`** now that the referenced tables exist — the Sprint 2/3 review flagged it as an unconstrained uuid awaiting exactly this.

- [ ] **Step 2: Stop generation when the product ends**

§5.6 공통: 해지/만기/상환완료 시 이후 자동생성 즉시 중단. When a product's status leaves `active`, set its rule to `ended` (which Task 1 made genuinely terminal) and skip future `planned` occurrences.

- [ ] **Step 3: Do NOT let a one-off edit rewrite the product**

§5.6: "월간 입력에서 수정한 1회성 실제금액이 원천 상품의 기본금액을 자동 변경하지 않음." Add a unit test asserting this.

- [ ] **Step 4: Verify + commit**

---

### Task 8: 기타자산 · 월별 스냅샷 · 순자산

**Files:** Create `supabase/migrations/20260902050000_assets_and_snapshots.sql`, `src/lib/assets.ts`, `src/lib/snapshots.ts`, `src/lib/net-worth.ts`, `tests/unit/net-worth.test.ts`, `src/actions/asset-actions.ts`, `src/actions/snapshot-actions.ts`, `src/app/(app)/finance/assets/page.tsx`; modify `src/app/(app)/finance/page.tsx`

- [ ] **Step 1: Net-worth pure function, TDD (§6.10, §6.11)**

Tests first:
- 금융자산 = 계좌잔액 + 예금원금 + 적금현재저축액 (+투자 — pass 0 this sprint)
- 총자산 = 금융자산 + 비금융자산
- 총부채 = 현재 대출잔금 합계
- 순자산 = 총자산 − 총부채
- 부채비율 = 총부채 / 순자산, with **0 and negative 순자산 handled explicitly** (§6.10 demands the exception case — assert it returns `null`, not `Infinity`/`NaN`)
- 월 증감액 = 현재월 − 전월; 월 증감률 = 증감액 / **전월** 순자산 (§6.11 — NOT Excel's 증감액/현재월). Assert the previous-month denominator, and that a zero previous month yields `null` rather than dividing by zero.

Then implement `src/lib/net-worth.ts`.

- [ ] **Step 2: Migration**

`assets` (§9.5): 자산명/유형(`real_estate|car|precious_metal|other`)/취득가/현재평가액/평가기준일/명의자/메모/상태.
`monthly_asset_snapshots` (§9.6): snapshot_month(`date`, month start)/cash_assets/deposit_assets/savings_assets/investment_assets/non_financial_assets/total_assets/total_debt/net_worth — all `bigint`. Unique on `(household_id, snapshot_month)`.

> §9.6/§23.13: a snapshot preserves the values **at save time** and must not change when product values later change. Store the computed numbers; do not recompute historical snapshots on read. This is the one place where storing derived values is correct, and the migration should say so — it is a deliberate exception to §0.4.

- [ ] **Step 3: [MANUAL — orchestrator] `npx supabase db push`**

- [ ] **Step 4: Snapshot save + 자산·금융 전체 탭**

`saveMonthlySnapshot(householdId, month)` computes today's figures via `net-worth.ts` and upserts on `(household_id, snapshot_month)`. The 전체 tab shows 총자산/총부채/순자산, 자산 구성, and 전월 대비 증감 from the two most recent snapshots.

- [ ] **Step 5: Verify + commit**

---

### Task 9: RLS integration coverage for the new tables

**Files:** Create `tests/integration/rls-finance.test.ts`

- [ ] **Step 1: Write it**

Follow `tests/integration/rls-transactions.test.ts`'s structure. For **each** new table (`accounts`, `cards`, `deposits`, `savings_accounts`, `loans`, `loan_payments`, `insurances`, `assets`, `monthly_asset_snapshots`):

- owner can insert + read their own row
- **user B cannot read it** (`error: null, data: []`)
- **user B cannot spoof an insert** into A's household (non-null error)
- **user B cannot update it** (`error: null, data: []`)
- **DELETE is denied** even for the owner (no DELETE policy)

**Every** cross-user probe must be preceded by `expect(signInError).toBeNull()` — the vacuous-pass trap this repo has now hit twice. Nine tables × 5 checks is repetitive; drive it with a table-driven loop over a `[{ table, ownRow, spoofRow }]` array rather than copy-pasting, but keep the sign-in assertion inside each iteration.

- [ ] **Step 2: Run live, verify, commit**

```bash
npm test   # allow ~60s since any prior integration run
```

---

## Self-Review Notes

- **Spec coverage:** §26 Sprint 4 bullets — accounts/cards ✓ T2, deposits/savings ✓ T3+T4, loans/payments ✓ T5+T6, insurance ✓ T6, monthly snapshots ✓ T8, 반복거래와 상품잔액 연계 ✓ T7. **investment/assets:** 기타자산 ✓ T8; **투자 deliberately deferred** — PRD §2.2 puts it in Phase 1.5 and §14 needs its own design. §6.7/§6.8/§6.9/§6.10/§6.11 calculations ✓ T3/T5/T8, all TDD per §25.
- **Carried debt closed:** the Sprint 2/3 review's three Important findings land in T1 rather than becoming a separate cycle.
- **Known deferrals:** 투자 (Phase 1.5); 대환/상환완료 이력 UI (§10.3 — `loans.status` supports it, no dedicated screen); 계좌번호 전체 표시의 AAL2 재인증 (§9.1 — masking ships, the re-auth gate does not); 보험 갱신/만기 임박 알림 (§11 dashboard — needs the dashboard work in a later sprint).
- **Ordering:** T1 first (unblocks nothing but closes shipped debt). T3 before T4, T5 before T6 (pure functions before the UI that renders them). T7 after T4+T6 (needs the product tables). T9 last (tests every table the sprint created).
- **Type consistency:** each product's row type is defined once in its `src/lib/*.ts` and imported; calculation inputs/outputs are defined in the calculation modules and reused by both the lib and the UI.
