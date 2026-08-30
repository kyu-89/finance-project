create or replace function public.update_recurring_rule_amount(
  p_rule_id uuid,
  p_amount bigint,
  p_effective_date date
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = 'check_violation';
  end if;

  update public.recurring_rules
  set default_amount = p_amount
  where id = p_rule_id and status <> 'ended';
  if not found then
    raise exception 'editable recurring rule not found' using errcode = 'check_violation';
  end if;

  update public.transactions
  set amount = p_amount
  where recurring_rule_id = p_rule_id
    and transaction_date >= date_trunc('month', p_effective_date)::date
    and status = 'planned'
    and deleted_at is null;
end;
$$;

revoke all on function public.update_recurring_rule_amount(uuid, bigint, date) from public;
grant execute on function public.update_recurring_rule_amount(uuid, bigint, date) to authenticated;
