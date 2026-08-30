create table public.support_programs (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  category text null, name text not null, target text null, application_period text null, receiving_period text null, payout_status text null,
  amount_per_occurrence numeric(24,8) null, total_expected_amount numeric(24,8) null, balance numeric(24,8) null, issuer text null, source_url text null, memo text null,
  source text not null default 'excel', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.event_records (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  event_date date not null, direction text not null check (direction in ('out','in')), counterparty text null, description text not null, amount bigint not null check (amount >= 0), group_name text null, source text not null default 'excel', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_programs_household_idx on public.support_programs(household_id);
create index event_records_household_date_idx on public.event_records(household_id,event_date);
alter table public.support_programs enable row level security;
alter table public.event_records enable row level security;
create policy "support_programs: owner" on public.support_programs for all to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "event_records: owner" on public.event_records for all to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
