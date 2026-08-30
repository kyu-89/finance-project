create table public.transaction_support_details (
  transaction_id uuid primary key references public.transactions (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  support_kind text not null,
  eligibility text null,
  application_period text null,
  receiving_period text null,
  payout_cycle text null check (payout_cycle in ('monthly','quarterly','yearly','one_time','custom')),
  expected_date date null,
  amount_per_occurrence bigint null check (amount_per_occurrence is null or amount_per_occurrence >= 0),
  total_expected_amount bigint null check (total_expected_amount is null or total_expected_amount >= 0),
  status text not null default 'planned' check (status in ('planned','eligible','applied','approved','receiving','completed','rejected','expired')),
  issuer text null, contact text null, source_url text null, beneficiary_member_id uuid null references public.household_members(id) on delete set null, deposit_account_id uuid null, memo text null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.transaction_event_details (
  transaction_id uuid primary key references public.transactions (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  event_type text not null check (event_type in ('wedding','condolence','gift','other')),
  counterparty text null, relationship_group text null, event_description text null,
  related_member_id uuid null references public.household_members(id) on delete set null, memo text null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  trade_date date not null, asset_name text not null, trade_type text not null check (trade_type in ('buy','sell')),
  unit_price numeric(24,8) not null default 0, trade_amount bigint not null check (trade_amount >= 0), fee numeric(24,8) not null default 0,
  settled_amount numeric(24,8) not null default 0, memo text null, source text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  goal_year integer not null, name text not null, target_amount bigint null, target_ratio numeric(8,4) null, start_date date null, target_date date null, current_value bigint null, memo text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.financial_tasks (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  task_date date not null, title text not null, description text null, completed boolean not null default false, related_type text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index investment_transactions_household_date_idx on public.investment_transactions(household_id, trade_date);
create index financial_tasks_household_date_idx on public.financial_tasks(household_id, task_date, completed);
create index financial_goals_household_year_idx on public.financial_goals(household_id, goal_year);
do $$ declare t text; begin foreach t in array array['transaction_support_details','transaction_event_details','investment_transactions','financial_goals','financial_tasks'] loop execute format('alter table public.%I enable row level security', t); execute format('create policy %I on public.%I for all to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())))', t || ': owner', t); end loop; end $$;
