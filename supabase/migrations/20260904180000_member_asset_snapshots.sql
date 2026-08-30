alter table public.monthly_asset_snapshots add column if not exists member_id uuid references public.household_members(id) on delete cascade;
alter table public.asset_value_history add column if not exists member_id uuid references public.household_members(id) on delete cascade;

alter table public.monthly_asset_snapshots drop constraint if exists monthly_asset_snapshots_household_id_snapshot_month_key;
alter table public.asset_value_history drop constraint if exists asset_value_history_household_id_snapshot_month_key;
create unique index if not exists monthly_asset_snapshots_household_month_member_key on public.monthly_asset_snapshots(household_id, snapshot_month, member_id);
create unique index if not exists asset_value_history_household_month_member_key on public.asset_value_history(household_id, snapshot_month, member_id);
create index if not exists monthly_asset_snapshots_member_month_idx on public.monthly_asset_snapshots(household_id, member_id, snapshot_month desc);
create index if not exists asset_value_history_member_month_idx on public.asset_value_history(household_id, member_id, snapshot_month desc);
