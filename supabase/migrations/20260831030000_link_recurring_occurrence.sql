create unique index recurring_occurrences_one_match_per_transaction
  on public.recurring_occurrences (matched_transaction_id)
  where matched_transaction_id is not null;

-- Atomically link a manually entered posted transaction and cancel the generated planned row.
-- SECURITY INVOKER is intentional: the caller's owner RLS remains in force for every lookup/update.
create or replace function public.link_recurring_occurrence(
  p_occurrence_id uuid,
  p_planned_transaction_id uuid,
  p_posted_transaction_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
  from public.recurring_occurrences
  where id = p_occurrence_id and matched_transaction_id is null
  for update;

  if v_household_id is null then
    raise exception 'linkable recurring occurrence not found' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.transactions
    where id = p_planned_transaction_id
      and household_id = v_household_id
      and recurring_occurrence_id = p_occurrence_id
      and status = 'planned'
      and deleted_at is null
  ) then raise exception 'planned transaction is invalid' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.transactions
    where id = p_posted_transaction_id
      and household_id = v_household_id
      and status = 'posted'
      and deleted_at is null
  ) then raise exception 'posted transaction is invalid' using errcode = 'check_violation';
  end if;

  update public.recurring_occurrences
  set matched_transaction_id = p_posted_transaction_id
  where id = p_occurrence_id;

  update public.transactions
  set status = 'cancelled'
  where id = p_planned_transaction_id;
end;
$$;

revoke all on function public.link_recurring_occurrence(uuid, uuid, uuid) from public;
grant execute on function public.link_recurring_occurrence(uuid, uuid, uuid) to authenticated;
