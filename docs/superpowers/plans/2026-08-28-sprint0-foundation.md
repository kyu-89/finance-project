# Sprint 0 — 뼈대/보안 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Manual/orchestrator-only steps:** Several steps require a human to run a command interactively (browser OAuth login, DB password entry) or configure the Supabase dashboard. These are marked **[MANUAL — orchestrator/user only]** and must NOT be delegated to a subagent — the top-level session (or the user directly, via `!`) must run them.

**Goal:** Stand up a working Next.js + Supabase foundation — project scaffold, Supabase-linked Postgres schema for `households`/`household_members`, email+password auth with enforced TOTP MFA (AAL2), a household auto-bootstrap on first login, the final 4-menu responsive app shell (대시보드/월간관리/자산·금융/설정) with placeholder pages, and an automated RLS cross-user isolation test — so every later sprint builds on a secure, tested base.

**Architecture:** Next.js App Router (TypeScript strict) talks to Supabase (Postgres + Auth) via `@supabase/ssr` (browser client in Client Components, cookie-based server client in Server Components/Route Handlers, session-refresh middleware). All household data lives in Postgres with RLS enforced by `auth.uid()`; no `service_role` key is ever imported into app code — it is used only inside a Node test script for creating/deleting throwaway test users.

**Tech Stack:** Next.js (App Router) · TypeScript strict · Tailwind CSS · @supabase/supabase-js + @supabase/ssr · Supabase CLI (schema migrations) · React Hook Form + Zod · Vitest (unit + integration tests) · Node v24.19.0 / npm 11.17.0 (already installed locally)

**Spec:** `docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md` (moved there in Task 1) — sections 0 (원칙), 3 (데이터 모델), 16 (인증/보안), 17 (스택), 19 (IA), 26 (Sprint 0), 29 (보안 체크리스트).

## Global Constraints

(copied verbatim from the spec — apply to every task below)

- 금액은 `bigint`(원 단위)로 저장한다. float/double 금지. (§3.2, §27)
- 클라이언트 코드에 `service_role` 키, DB 비밀번호, 개인 비밀키를 절대 포함하지 않는다. (§0.7, §27)
- `.env*` 파일은 Git에 커밋하지 않는다. (§0.8, §16.3)
- 모든 사용자 데이터 테이블은 RLS를 활성화하고 `auth.uid()` 기반으로 격리한다. (§0.6, §16.2)
- 1차 메뉴는 `대시보드 / 월간관리 / 자산·금융 / 설정` 4개만 사용한다. 별도 1차 메뉴를 만들지 않는다. (§0.13, §19.1)
- MVP라도 모바일/PC 반응형을 동시에 지원한다. (§0.11)
- TypeScript strict 모드를 유지한다(`tsconfig.json`의 `strict: true`). (§17 Frontend 스택)
- 계산 검증용 테스트를 반드시 작성한다. (§0.12)
- SMS 기반 인증은 사용하지 않는다. Email + Password + TOTP MFA를 사용한다. (§16.1)
- GitHub repo는 Private 권장, `.gitignore`에 `.env*`, Excel, export 파일 포함. (§16.3, §29)
- `security definer` 함수 사용을 최소화한다. (§26 QA)

---

## File Structure

```
personal-finance/
  docs/
    HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md      (moved here, Task 1)
    superpowers/plans/2026-08-28-sprint0-foundation.md
  .gitignore
  package.json
  tsconfig.json
  next.config.ts
  vitest.config.ts
  .env.local.example                        (committed template)
  .env.local                                 (gitignored, real values)
  .env.test.local.example                    (committed template)
  .env.test.local                            (gitignored, service_role for tests only)
  supabase/
    config.toml
    migrations/
      20260828010000_households_and_members.sql
  src/
    lib/
      env.ts
      supabase/
        client.ts
        server.ts
        proxy.ts
    proxy.ts
    actions/
      household.ts
    components/
      nav/
        AppShell.tsx
        DesktopSidebar.tsx
        MobileBottomNav.tsx
    app/
      layout.tsx
      globals.css
      login/page.tsx
      signup/page.tsx
      auth/callback/route.ts
      mfa/
        enroll/page.tsx
        verify/page.tsx
      (app)/
        layout.tsx
        dashboard/page.tsx
        monthly/page.tsx
        finance/page.tsx
        settings/page.tsx
        quick-add/page.tsx
  tests/
    setup-env.ts
    unit/
      nav-items.test.ts
    integration/
      rls-households.test.ts
```

---

### Task 1: Repo bootstrap — move PRD, scaffold Next.js, add tooling

**Files:**
- Move: `HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md` → `docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md`
- Create: entire Next.js scaffold (via `create-next-app`), `vitest.config.ts`, `tests/setup-env.ts`, `tests/unit/nav-items.test.ts`, `.gitignore` additions

**Interfaces:**
- Produces: TypeScript path alias `@/*` → `src/*`; npm scripts `dev`, `build`, `test`, `test:watch`.

- [ ] **Step 1: Move the PRD into `docs/` so the directory is empty enough for `create-next-app`**

`create-next-app` refuses to scaffold into a non-empty directory unless it only contains a small safelist (`.git`, `docs`, `LICENSE`, etc.) — an arbitrary `.md` file is not on that list.

```bash
cd "C:/Users/미니쉬테크놀로지-김규남/Desktop/dev/personal-finance"
mkdir -p docs
mv "HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md" "docs/HOUSEHOLD_FINANCE_WEB_PRD_v0.8.md"
```

- [ ] **Step 2: Scaffold Next.js in the current directory**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Answer any remaining interactive prompt with the defaults shown (App Router: yes, already passed via flags).

- [ ] **Step 3: Verify the scaffold builds**

Run: `npm run build`
Expected: build completes with the default Next.js starter page, exit code 0.

- [ ] **Step 4: Install app dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @tanstack/react-table recharts
```

- [ ] **Step 5: Install test dependencies**

```bash
npm install -D vitest dotenv @types/node
```

- [ ] **Step 6: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    hookTimeout: 20000,
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `tests/setup-env.ts`:

```ts
import { config } from 'dotenv';

// Integration tests need SUPABASE_SERVICE_ROLE_KEY; unit tests need nothing.
// Both files are gitignored — see .env.test.local.example for the template.
config({ path: '.env.test.local' });
config({ path: '.env.local' });
```

- [ ] **Step 7: Add test scripts to `package.json`**

Add under `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Write a trivial smoke unit test to prove Vitest + path alias work**

Create `src/lib/nav-items.ts`:

```ts
export type NavItem = {
  key: 'dashboard' | 'monthly' | 'finance' | 'settings';
  label: string;
  href: string;
};

// The 4 first-level menus mandated by PRD §0.13 / §19.1 — do not add a 5th.
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '대시보드', href: '/dashboard' },
  { key: 'monthly', label: '월간관리', href: '/monthly' },
  { key: 'finance', label: '자산·금융', href: '/finance' },
  { key: 'settings', label: '설정', href: '/settings' },
];
```

Create `tests/unit/nav-items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/lib/nav-items';

describe('NAV_ITEMS', () => {
  it('exposes exactly the 4 first-level menus mandated by the PRD', () => {
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      'dashboard',
      'monthly',
      'finance',
      'settings',
    ]);
  });

  it('never grows a 5th top-level menu', () => {
    expect(NAV_ITEMS).toHaveLength(4);
  });
});
```

- [ ] **Step 9: Run the smoke test**

Run: `npm test`
Expected: `tests/unit/nav-items.test.ts` — 2 passed.

- [ ] **Step 10: Extend `.gitignore` per PRD §16.3/§29**

Append to the `.gitignore` that `create-next-app` generated:

```gitignore
# Supabase / secrets (PRD §16.3, §29)
.env*.local
.env.test.local
supabase/.temp

# Legacy Excel source + exports (PRD §29 checklist)
*.xlsm
*.xlsx
*.csv
```

- [ ] **Step 11: Commit**

(Deferred to Task 2 Step 3, after `git init` — this task's files are staged together with the git bootstrap.)

---

### Task 2: Git bootstrap

**Files:**
- Create: `.git/` (via `git init`)

- [ ] **Step 1: Initialize the repository**

```bash
git init
git branch -M main
```

- [ ] **Step 2: Confirm no secrets are staged**

```bash
git status --short
```

Expected: no `.env.local`, `.env.test.local`, or `*.xlsm`/`*.xlsx` files listed (they must be ignored, not merely absent).

- [ ] **Step 3: Initial commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js app + PRD relocation + test tooling"
```

- [ ] **Step 4: [MANUAL — user only] Create a private GitHub repo and push**

Per PRD §16.3 ("GitHub repo는 Private 권장"), the user creates the remote (e.g. via `gh repo create personal-finance --private --source=. --remote=origin`) and pushes. Not required to proceed with later tasks — can be done at any point once Task 2 Step 3 lands.

---

### Task 3: Supabase client setup (no network calls yet)

**Files:**
- Create: `src/lib/env.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `.env.local.example`, `.env.local`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Produces: `env.supabaseUrl: string`, `env.supabasePublishableKey: string`; `createClient()` (browser, sync) from `@/lib/supabase/client`; `createClient()` (server, async) from `@/lib/supabase/server`.

- [ ] **Step 1: Write the failing test for env validation**

Create `tests/unit/env.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('env', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(async () => {
      const mod = await import('@/lib/env?t=' + Date.now());
      return mod;
    }).rejects.toThrow('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- env.test.ts`
Expected: FAIL — `Cannot find module '@/lib/env'` (module does not exist yet).

- [ ] **Step 3: Implement `src/lib/env.ts`**

```ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabasePublishableKey: requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- env.test.ts`
Expected: PASS (1 test — the dynamic-import-per-test trick means only the "throws" case is asserted here; that is sufficient to prove the guard works).

- [ ] **Step 5: Create `.env.local.example` (committed template — no real secrets)**

```bash
# Public — safe to expose in the browser bundle (Supabase publishable key, RLS-protected).
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 6: Create `.env.local` with the real (already-public) project values**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://lshqugxbddcpwugadjxe.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DQuCiamy0bSGG6dIkdqscg_UratTIAn
```

(This file is gitignored per Task 1 Step 10 — verify with `git check-ignore -v .env.local`.)

- [ ] **Step 7: Implement the browser Supabase client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
```

- [ ] **Step 8: Implement the server Supabase client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render — middleware refreshes the session instead.
        }
      },
    },
  });
}
```

- [ ] **Step 9: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds (env vars are present via `.env.local`).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Supabase client/server setup with validated env access"
```

---

### Task 4: Database schema — `households` / `household_members` + RLS

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20260828010000_households_and_members.sql`

**Interfaces:**
- Produces: tables `public.households(id, owner_user_id, name, created_at, updated_at)`, `public.household_members(id, household_id, member_type, display_name, linked_user_id, is_active, created_at, updated_at)`, both RLS-enabled.

- [ ] **Step 1: Initialize the Supabase CLI project**

```bash
npx supabase init
```

Expected: creates `supabase/config.toml` and `supabase/` scaffold. When prompted about VS Code settings, either answer is fine.

- [ ] **Step 2: [MANUAL — user only] Log in and link the project**

The user runs these themselves (browser OAuth + DB password prompt — must not be typed into this session):

```
! npx supabase login
! npx supabase link --project-ref lshqugxbddcpwugadjxe
```

Confirm back once linked (the CLI prints "Finished supabase link").

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260828010000_households_and_members.sql`:

```sql
-- households: one row per household (PRD §3.1 — even a single-person user gets a household)
create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '우리집',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- household_members: the shared analysis axis for every financial record (PRD §3.1)
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_type text not null check (member_type in ('self', 'spouse', 'child', 'other')),
  display_name text not null,
  linked_user_id uuid null references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_members_household_id_idx on public.household_members (household_id);
create unique index households_owner_user_id_idx on public.households (owner_user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- households policies: owner_user_id = auth.uid() (PRD §16.2)
create policy "households: owner select"
on public.households for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy "households: owner insert"
on public.households for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy "households: owner update"
on public.households for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "households: owner delete"
on public.households for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

-- household_members policies: gated through the parent household's owner_user_id
create policy "household_members: owner select"
on public.household_members for select
to authenticated
using (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);

create policy "household_members: owner insert"
on public.household_members for insert
to authenticated
with check (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);

create policy "household_members: owner update"
on public.household_members for update
to authenticated
using (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
)
with check (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);

create policy "household_members: owner delete"
on public.household_members for delete
to authenticated
using (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);
```

- [ ] **Step 4: [MANUAL — user only] Push the migration**

```
! npx supabase db push
```

Confirm back once it reports the migration applied successfully.

- [ ] **Step 5: [MANUAL — user only] Enable email confirmation in the Supabase dashboard**

Supabase Dashboard → Authentication → Providers → Email → ensure "Confirm email" is ON (PRD §16.1 온보딩 step 2). This cannot be set via SQL migration.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat: households/household_members schema with RLS"
```

---

### Task 5: Email/password auth pages

**Files:**
- Create: `src/app/signup/page.tsx`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/client` (Task 3).
- Produces: routes `/signup`, `/login`; after successful signup, redirects to `/login?confirm=1`; after successful login, redirects to `/mfa/verify` (Task 6 owns that route — link, do not implement here).

- [ ] **Step 1: Signup page**

Create `src/app/signup/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    router.push('/login?confirm=1');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">회원가입</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? '가입 중...' : '가입하기'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Login page**

Create `src/app/login/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSignedUp = searchParams.get('confirm') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push('/mfa/verify');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">로그인</h1>
      {justSignedUp && (
        <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">
          가입 확인 이메일을 보냈습니다. 이메일 확인 후 로그인해주세요.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Email confirmation callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/login`);
}
```

- [ ] **Step 4: Manual verification (no automated test — this is exercised end-to-end in Task 9)**

Run: `npm run dev`, visit `http://localhost:3000/signup`, submit a throwaway email/password.
Expected: redirected to `/login?confirm=1` and the info banner is shown; no console errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: email/password signup and login pages"
```

---

### Task 6: TOTP MFA enrollment + verification, AAL2 enforcement middleware

**Files:**
- Create: `src/app/mfa/enroll/page.tsx`, `src/app/mfa/verify/page.tsx`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`

**Interfaces:**
- Consumes: `createClient()` (browser, Task 3).
- Produces: routes `/mfa/enroll`, `/mfa/verify`; root middleware redirects any unauthenticated request to a protected path to `/login`, and any authenticated-but-aal1 request to a protected path to `/mfa/verify`.

- [ ] **Step 1: MFA enrollment page**

Create `src/app/mfa/enroll/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function MfaEnrollPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enroll() {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (enrollError) {
        setError(enrollError.message);
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }

    enroll();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">2단계 인증(TOTP) 설정</h1>
      <p className="text-sm text-gray-600">
        Google Authenticator, 1Password 등 인증 앱으로 아래 QR 코드를 스캔하세요.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {qrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCode} alt="TOTP QR 코드" className="h-48 w-48 self-center" />
      )}
      {secret && (
        <p className="break-all text-xs text-gray-500">수동 입력 키: {secret}</p>
      )}
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          required
          placeholder="6자리 코드"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          확인 및 활성화
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: MFA verify page (returning users with an existing factor)**

Create `src/app/mfa/verify/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFactors() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();

      if (listError) {
        setError(listError.message);
        return;
      }

      const verifiedTotp = data.totp.find((f) => f.status === 'verified');

      if (!verifiedTotp) {
        setNeedsEnrollment(true);
        router.replace('/mfa/enroll');
        return;
      }

      setFactorId(verifiedTotp.id);
    }

    loadFactors();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push('/dashboard');
  }

  if (needsEnrollment) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">2단계 인증 코드 입력</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          required
          placeholder="6자리 코드"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          확인
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Session-refresh + AAL2 enforcement proxy helper**

> **Next.js 16 note:** the special root file is `proxy.ts` with a `proxy` export — `middleware.ts`/`export function middleware` is deprecated in Next.js 16 (renamed to clarify network-boundary/routing focus; functionality is identical). Do not use the old `middleware` naming. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` if anything here is unclear.

Create `src/lib/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

// Protected app routes — must match the 4 menus + quick-add entry point (PRD §19.1),
// plus /mfa itself: an anonymous visitor must still be bounced to /login from /mfa/*.
const PROTECTED_PREFIXES = ['/dashboard', '/monthly', '/finance', '/settings', '/quick-add', '/mfa'];
// Routes reachable while only at AAL1 (mid-MFA-flow) even though they're "protected".
const AAL2_EXEMPT_PREFIXES = ['/mfa'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAal2Exempt = AAL2_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isProtected && user && !isAal2Exempt) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Fail closed: if the AAL lookup itself errors (aal === null), treat it as "not aal2"
    // rather than silently skipping the check and letting the request through.
    if (!aal || aal.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/mfa/verify', request.url));
    }
  }

  return response;
}
```

- [ ] **Step 4: Root proxy**

Create `src/proxy.ts`:

```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in with the account created in Task 5. Confirm:
1. Visiting `/dashboard` before MFA enrollment redirects to `/mfa/verify`, which itself redirects to `/mfa/enroll` (no verified factor yet).
2. Scanning the QR with an authenticator app and entering the code redirects to `/dashboard`.
3. Logging out and back in redirects to `/mfa/verify` (factor already exists) and accepts the app's current code.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: TOTP MFA enrollment/verification + AAL2 enforcement middleware"
```

---

### Task 7: Household auto-bootstrap

**Files:**
- Create: `src/actions/household.ts`

**Interfaces:**
- Consumes: `createClient()` (server, Task 3), tables from Task 4.
- Produces: `ensureHouseholdForCurrentUser(): Promise<{ id: string; ownerUserId: string; name: string }>` — get-or-create, idempotent. Consumed by Task 8's protected layout.

- [ ] **Step 1: Implement the server action**

Create `src/actions/household.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';

export type Household = {
  id: string;
  ownerUserId: string;
  name: string;
};

export async function ensureHouseholdForCurrentUser(): Promise<Household> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('로그인이 필요합니다.');
  }

  const { data: existing, error: selectError } = await supabase
    .from('households')
    .select('id, owner_user_id, name')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(`가구 조회 실패: ${selectError.message}`);
  }

  if (existing) {
    return { id: existing.id, ownerUserId: existing.owner_user_id, name: existing.name };
  }

  const { data: household, error: insertError } = await supabase
    .from('households')
    .insert({ owner_user_id: user.id, name: '우리집' })
    .select('id, owner_user_id, name')
    .single();

  if (insertError) {
    throw new Error(`가구 생성 실패: ${insertError.message}`);
  }

  const { error: memberError } = await supabase.from('household_members').insert({
    household_id: household.id,
    member_type: 'self',
    display_name: '본인',
  });

  if (memberError) {
    throw new Error(`기본 구성원 생성 실패: ${memberError.message}`);
  }

  return { id: household.id, ownerUserId: household.owner_user_id, name: household.name };
}
```

(No unit test here — this function's correctness under concurrent/repeated calls is exactly what Task 9's integration test verifies against the real linked database, since mocking `@supabase/ssr` would only test the mock.)

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: household auto-bootstrap server action"
```

---

### Task 8: App shell — 4-menu responsive navigation + placeholder pages

**Files:**
- Create: `src/components/nav/AppShell.tsx`, `src/components/nav/DesktopSidebar.tsx`, `src/components/nav/MobileBottomNav.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/monthly/page.tsx`, `src/app/(app)/finance/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/quick-add/page.tsx`

**Interfaces:**
- Consumes: `NAV_ITEMS` (Task 1), `ensureHouseholdForCurrentUser` (Task 7).

- [ ] **Step 1: Desktop sidebar**

Create `src/components/nav/DesktopSidebar.tsx`:

```tsx
import Link from 'next/link';
import { NAV_ITEMS } from '@/lib/nav-items';

export function DesktopSidebar() {
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r p-4 md:flex">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="rounded px-3 py-2 text-sm hover:bg-gray-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Mobile bottom nav (5 slots per PRD §19.5: 홈/내역/＋/자산/더보기)**

Create `src/components/nav/MobileBottomNav.tsx`:

```tsx
import Link from 'next/link';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: '홈' },
  { href: '/monthly', label: '내역' },
  { href: '/quick-add', label: '＋' },
  { href: '/finance', label: '자산' },
  { href: '/settings', label: '더보기' },
] as const;

export function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t bg-white md:hidden">
      {MOBILE_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex-1 py-3 text-center text-xs"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: App shell composing both**

Create `src/components/nav/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Protected route group layout — bootstraps the household before rendering**

Create `src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ensureHouseholdForCurrentUser } from '@/actions/household';
import { AppShell } from '@/components/nav/AppShell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureHouseholdForCurrentUser();

  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 5: Placeholder pages for the 4 menus + quick-add**

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">대시보드</h1>
      <p className="text-sm text-gray-500">Sprint 1에서 KPI/추이/드릴다운을 구현합니다.</p>
    </div>
  );
}
```

Create `src/app/(app)/monthly/page.tsx`:

```tsx
export default function MonthlyPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">월간관리</h1>
      <p className="text-sm text-gray-500">
        Sprint 1에서 월간입력/전체내역/예산·결산/반복항목/월말점검 탭을 구현합니다.
      </p>
    </div>
  );
}
```

Create `src/app/(app)/finance/page.tsx`:

```tsx
export default function FinancePage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">자산·금융</h1>
      <p className="text-sm text-gray-500">Sprint 4에서 계좌/카드/예적금/투자/대출/보험을 구현합니다.</p>
    </div>
  );
}
```

Create `src/app/(app)/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">설정</h1>
      <p className="text-sm text-gray-500">가족 구성원/카테고리/목표·일정/데이터/보안을 관리합니다.</p>
    </div>
  );
}
```

Create `src/app/(app)/quick-add/page.tsx`:

```tsx
export default function QuickAddPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">거래 기록</h1>
      <p className="text-sm text-gray-500">
        Sprint 1에서 금액 → 대분류 → 소분류 → 결제수단 → 내용 → 저장(10초 입력)을 구현합니다.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Log in and pass MFA. Confirm:
1. Desktop viewport shows the left sidebar with exactly 4 links.
2. Narrow (mobile) viewport shows the 5-slot bottom nav instead.
3. Navigating to any of `/dashboard`, `/monthly`, `/finance`, `/settings`, `/quick-add` renders its placeholder without error.
4. In the Supabase dashboard's Table Editor, exactly one `households` row and one `household_members` row (`member_type = 'self'`) exist for this user — confirming Task 7's bootstrap ran.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 4-menu responsive app shell + placeholder pages"
```

---

### Task 9: RLS cross-user isolation integration test

**Files:**
- Create: `.env.test.local.example`, `.env.test.local`, `tests/integration/rls-households.test.ts`

**Interfaces:**
- Consumes: `env.supabaseUrl`/`env.supabasePublishableKey` (Task 3), `households`/`household_members` schema (Task 4). Uses `@supabase/supabase-js`'s `createClient` directly (not the Next-bound `@/lib/supabase/client`, since this runs in plain Node, not a browser/React context).

- [ ] **Step 1: [MANUAL — user only] Add the service_role key for test setup/teardown only**

Create `.env.test.local.example` (committed):

```bash
# Supabase Dashboard → Settings → API → service_role secret.
# NEVER import this outside test files. NEVER commit the real value.
SUPABASE_SERVICE_ROLE_KEY=
```

The user copies this to `.env.test.local` and fills in the real `service_role` secret from the Supabase dashboard themselves (not pasted into this session).

- [ ] **Step 2: Write the failing integration test**

Create `tests/integration/rls-households.test.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function randomTestEmail(label: string) {
  return `sprint0-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('households/household_members RLS', () => {
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let userAId: string;
  let userBId: string;
  let userAHouseholdId: string;
  const userAEmail = randomTestEmail('a');
  const userBEmail = randomTestEmail('b');
  const password = 'Sprint0-Test-Password-1!';

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
  });

  afterAll(async () => {
    // Deleting the auth users cascades to households (FK on delete cascade),
    // which cascades to household_members.
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  it('lets a user create and read their own household', async () => {
    const asUserA = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    const { error: signInError } = await asUserA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(signInError).toBeNull();

    const { data: inserted, error: insertError } = await asUserA
      .from('households')
      .insert({ owner_user_id: userAId, name: 'A네 집' })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(inserted?.id).toBeTruthy();
    userAHouseholdId = inserted!.id;

    const { data: selected, error: selectError } = await asUserA
      .from('households')
      .select('id, name')
      .eq('id', userAHouseholdId)
      .maybeSingle();

    expect(selectError).toBeNull();
    expect(selected?.name).toBe('A네 집');
  });

  it("hides user A's household from user B", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    await asUserB.auth.signInWithPassword({ email: userBEmail, password });

    const { data: selected, error: selectError } = await asUserB
      .from('households')
      .select('id')
      .eq('id', userAHouseholdId);

    expect(selectError).toBeNull();
    expect(selected).toEqual([]);
  });

  it('blocks user B from spoofing an insert with owner_user_id = user A', async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    await asUserB.auth.signInWithPassword({ email: userBEmail, password });

    const { error: insertError } = await asUserB
      .from('households')
      .insert({ owner_user_id: userAId, name: '스푸핑 시도' });

    expect(insertError).not.toBeNull();
  });

  it("blocks user B from updating user A's household", async () => {
    const asUserB = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
    await asUserB.auth.signInWithPassword({ email: userBEmail, password });

    const { data: updated, error: updateError } = await asUserB
      .from('households')
      .update({ name: '해킹당함' })
      .eq('id', userAHouseholdId)
      .select('id');

    expect(updateError).toBeNull();
    expect(updated).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails (before the fill-in of `.env.test.local` or before Task 4's migration is pushed, this must fail loudly, not silently pass)**

Run: `npm test -- rls-households.test.ts`
Expected: FAIL with either a missing-env error (if `.env.test.local` isn't filled in yet) or a schema error (if Task 4 Step 4 hasn't been pushed yet). Confirm which, and resolve the blocking prerequisite before continuing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rls-households.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run the entire test suite**

Run: `npm test`
Expected: all unit + integration tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: RLS cross-user isolation for households/household_members"
```

---

### Task 10: Final walkthrough + Definition of Done check

**Files:** none (verification only)

- [ ] **Step 1: Full clean build + test run**

```bash
rm -rf .next
npm run build
npm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 2: End-to-end manual walkthrough**

1. Sign up a fresh throwaway account at `/signup`.
2. Confirm the email (check inbox — email confirmation is ON per Task 4 Step 5).
3. Log in at `/login` → redirected through `/mfa/verify` → `/mfa/enroll` (first time).
4. Scan QR, verify code → redirected to `/dashboard`.
5. Confirm exactly one `households` + one `household_members` row exists for this user in the Supabase Table Editor.
6. Confirm the 4-menu nav (desktop) / 5-slot bottom nav (mobile viewport via devtools) both work and route correctly.
7. Log out, log back in → goes straight to `/mfa/verify` (no re-enrollment) → `/dashboard`.

- [ ] **Step 3: Cross-check against PRD §26 Sprint 0 scope**

Confirm each item is done: Next.js 초기화 ✓, Supabase project ✓, Auth + TOTP MFA ✓, household/member model ✓, RLS base policy ✓, 최종 4메뉴 IA/responsive navigation ✓.

- [ ] **Step 4: Commit any final fixups, then stop — do not start Sprint 1 tasks under this plan**

Sprint 1 (categories/payment methods/transactions/mobile quick entry/PC 월간입력) gets its own plan document once this one is fully checked off, per the PRD's own vertical-slice-first guidance (§32).

---

## Self-Review Notes

- **Spec coverage:** §0 (원칙 1–14) — addressed by RLS (✓ #6), no service_role in client (✓ #7), env secrets (✓ #8), 4-menu IA (✓ #13); §3 (households/household_members model) ✓ Task 4; §16 (email+TOTP, no SMS, RLS, `.env` hygiene) ✓ Tasks 5/6/4; §17 (stack) ✓ Task 1/3 (remaining stack libs — TanStack Table, Recharts, RHF+Zod — are installed now and consumed starting Sprint 1); §19 (4-menu IA, mobile 5-slot nav) ✓ Task 8; §26 Sprint 0 bullet list ✓ Task 10 Step 3; §29 checklist items covered by Sprint 0 (private repo, `.gitignore`, email verification, TOTP+AAL2, RLS, service_role server-only) ✓ Tasks 1/2/4/5/6/9 — remaining §29 items (CAPTCHA, export AAL2, destructive-action reconfirm, dependency audit) are out of scope for Sprint 0 and are flagged below as deferred with rationale, per §0.10 ("불가피하면 TODO와 근거를 남긴다").
- **Deferred with rationale (not silently dropped):**
  - Cloudflare Turnstile CAPTCHA (§16.4, §29): PRD uses "고려한다" (consider), not a Sprint 0 requirement, and needs an external Cloudflare site key the user must provision. Add as a Sprint 1 or later task once an account exists.
  - Local Supabase stack (`supabase start`) for tests: skipped because Docker is not installed on this machine. Task 9 instead runs integration tests against the linked remote project using throwaway users cleaned up in `afterAll`. Revisit if Docker becomes available.
- **Placeholder scan:** no "TBD"/"handle appropriately"/unshown code — every step has runnable code or an exact command.
- **Type consistency:** `Household` type (`id`, `ownerUserId`, `name`) defined once in Task 7 and not redefined elsewhere; `NAV_ITEMS`/`NavItem` defined once in Task 1 and consumed as-is in Task 8; `createClient()` naming is intentionally duplicated (browser vs. server module) matching the official `@supabase/ssr` convention — call sites always import from the specific module (`@/lib/supabase/client` or `@/lib/supabase/server`), never both in the same file.
