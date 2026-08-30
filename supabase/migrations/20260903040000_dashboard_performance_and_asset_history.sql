alter table public.households
  add column if not exists initialized_at timestamptz null;

-- All households that predate this marker have already passed through the bootstrap
-- routine in production. New households keep NULL until their one-time seed completes.
update public.households
set initialized_at = coalesce(initialized_at, now());

create table public.asset_value_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  snapshot_month date not null,
  total_assets bigint not null check (total_assets >= 0),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (household_id, snapshot_month)
);

create index asset_value_history_household_month_idx
  on public.asset_value_history(household_id, snapshot_month desc);

alter table public.asset_value_history enable row level security;

create policy "asset_value_history: owner"
on public.asset_value_history for all to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
