create or replace function public.update_recurring_rule_schedule(
  p_rule_id uuid,
  p_frequency text,
  p_interval_count integer,
  p_day_of_month integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.recurring_rules r
    join public.households h on h.id = r.household_id
    where r.id = p_rule_id and h.owner_user_id = auth.uid() and r.status <> 'ended'
  ) then
    raise exception 'editable recurring rule not found' using errcode = 'check_violation';
  end if;

  delete from public.transactions t
  using public.recurring_occurrences o
  where t.recurring_occurrence_id = o.id
    and o.recurring_rule_id = p_rule_id
    and o.occurrence_date >= current_date
    and t.status = 'planned'
    and t.deleted_at is null;

  delete from public.recurring_occurrences o
  where o.recurring_rule_id = p_rule_id
    and o.occurrence_date >= current_date
    and not exists (select 1 from public.transactions t where t.recurring_occurrence_id = o.id);

  update public.recurring_rules
  set frequency = p_frequency,
      interval_count = p_interval_count,
      day_of_month = case when p_frequency = 'monthly' then p_day_of_month else null end
  where id = p_rule_id and status <> 'ended';
end;
$$;

revoke all on function public.update_recurring_rule_schedule(uuid, text, integer, integer) from public;
grant execute on function public.update_recurring_rule_schedule(uuid, text, integer, integer) to authenticated;
