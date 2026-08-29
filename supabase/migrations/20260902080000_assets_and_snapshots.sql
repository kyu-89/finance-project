create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  asset_name text not null check (length(trim(asset_name)) > 0),
  asset_type text not null check (asset_type in ('real_estate', 'car', 'precious_metal', 'other')),
  acquisition_cost bigint not null default 0 check (acquisition_cost >= 0),
  current_value bigint not null check (current_value >= 0),
  valuation_date date not null,
  owner_member_id uuid null references public.household_members (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'disposed')),
  disposed_at date null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((status = 'active' and disposed_at is null) or status = 'disposed')
);

-- Deliberate exception to the no-derived-data rule: a snapshot preserves the values at save time.
-- Later product edits must not rewrite history (PRD §9.6/§23.13).
create table public.monthly_asset_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  snapshot_month date not null check (extract(day from snapshot_month) = 1),
  cash_assets bigint not null, deposit_assets bigint not null, savings_assets bigint not null,
  investment_assets bigint not null default 0, non_financial_assets bigint not null,
  total_assets bigint not null, total_debt bigint not null, net_worth bigint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (household_id, snapshot_month)
);

create index assets_household_status_idx on public.assets (household_id, status);
create index snapshots_household_month_idx on public.monthly_asset_snapshots (household_id, snapshot_month desc);
alter table public.assets enable row level security;
alter table public.monthly_asset_snapshots enable row level security;

create policy "assets: owner select" on public.assets for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "assets: owner insert" on public.assets for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "assets: owner update" on public.assets for update to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "snapshots: owner select" on public.monthly_asset_snapshots for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "snapshots: owner insert" on public.monthly_asset_snapshots for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "snapshots: owner update" on public.monthly_asset_snapshots for update to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger snapshots_set_updated_at before update on public.monthly_asset_snapshots for each row execute function public.set_updated_at();
create or replace function public.asset_tenant_check() returns trigger language plpgsql as $$
begin
  if new.owner_member_id is not null and not exists (select 1 from public.household_members m where m.id = new.owner_member_id and m.household_id = new.household_id) then
    raise exception 'assets.owner_member_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger asset_tenant_check_trigger before insert or update on public.assets for each row execute function public.asset_tenant_check();
create trigger assets_active_state_is_terminal_trigger before update of status on public.assets
for each row execute function public.product_active_state_is_terminal();
-- Assets and saved history are lifecycle records; intentionally no DELETE policies.
