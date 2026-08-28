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

-- categories: owner-scoped through household_id, same pattern as household_members (Sprint 0).
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
