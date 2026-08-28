-- Keep rule lifecycle and already-materialized future transactions consistent (PRD §5.5.4).
create or replace function public.update_recurring_rule_status(
  p_rule_id uuid,
  p_status text,
  p_effective_date date
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_start_date date;
begin
  if p_status not in ('active', 'paused', 'ended') then
    raise exception 'invalid recurring rule status' using errcode = 'check_violation';
  end if;

  select start_date into v_start_date
  from public.recurring_rules
  where id = p_rule_id
  for update;
  if v_start_date is null then
    raise exception 'recurring rule not found' using errcode = 'check_violation';
  end if;

  update public.recurring_rules
  set status = p_status,
      end_date = case
        when p_status = 'ended' then greatest(v_start_date, p_effective_date)
        else end_date
      end
  where id = p_rule_id;

  if p_status in ('paused', 'ended') then
    update public.transactions
    set status = 'skipped'
    where recurring_rule_id = p_rule_id
      and transaction_date >= p_effective_date
      and status = 'planned'
      and deleted_at is null;
  end if;
end;
$$;

revoke all on function public.update_recurring_rule_status(uuid, text, date) from public;
grant execute on function public.update_recurring_rule_status(uuid, text, date) to authenticated;
