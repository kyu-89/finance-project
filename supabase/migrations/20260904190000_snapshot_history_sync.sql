create or replace function public.sync_asset_value_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.asset_value_history
  where household_id = new.household_id
    and snapshot_month = new.snapshot_month
    and member_id is not distinct from new.member_id;
  insert into public.asset_value_history (household_id, snapshot_month, member_id, total_assets, source)
  values (new.household_id, new.snapshot_month, new.member_id, new.total_assets, 'snapshot');
  return new;
end;
$$;

drop trigger if exists monthly_snapshot_history_sync on public.monthly_asset_snapshots;
create trigger monthly_snapshot_history_sync
after insert or update on public.monthly_asset_snapshots
for each row execute function public.sync_asset_value_history();
