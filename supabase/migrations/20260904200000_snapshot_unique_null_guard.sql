drop index if exists public.monthly_asset_snapshots_household_month_member_key;
drop index if exists public.asset_value_history_household_month_member_key;

create unique index monthly_asset_snapshots_household_month_member_key
  on public.monthly_asset_snapshots (household_id, snapshot_month, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid));
create unique index asset_value_history_household_month_member_key
  on public.asset_value_history (household_id, snapshot_month, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid));
