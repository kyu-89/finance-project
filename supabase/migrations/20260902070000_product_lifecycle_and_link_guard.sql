-- A product that stopped generating payments must never be revived while its linked recurring
-- rule remains terminal. Insurance may still move from paid-up(`free`) to terminated, but none
-- of the product types may move back to active through a direct PostgREST PATCH.
create or replace function public.product_active_state_is_terminal()
returns trigger language plpgsql as $$
begin
  if old.status <> 'active' and new.status = 'active' then
    raise exception '종료된 금융상품은 다시 활성화할 수 없습니다' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger savings_active_state_is_terminal_trigger before update of status on public.savings_accounts
for each row execute function public.product_active_state_is_terminal();
create trigger loans_active_state_is_terminal_trigger before update of status on public.loans
for each row execute function public.product_active_state_is_terminal();
create trigger insurances_active_state_is_terminal_trigger before update of status on public.insurances
for each row execute function public.product_active_state_is_terminal();

-- Linking is allowed to reconcile a manually posted actual amount with a planned amount, so the
-- amount may differ. Its semantic flow may not: linking saving/debt principal to consumption would
-- silently erase the product payment from every financial aggregate (PRD §5.5.6/§23.5~7).
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
  v_planned_type text;
  v_planned_flow text;
begin
  select household_id into v_household_id
  from public.recurring_occurrences
  where id = p_occurrence_id and matched_transaction_id is null
  for update;
  if v_household_id is null then
    raise exception 'linkable recurring occurrence not found' using errcode = 'check_violation';
  end if;

  select transaction_type, flow_class into v_planned_type, v_planned_flow
  from public.transactions
  where id = p_planned_transaction_id and household_id = v_household_id
    and recurring_occurrence_id = p_occurrence_id and status = 'planned' and deleted_at is null;
  if v_planned_type is null then
    raise exception 'planned transaction is invalid' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.transactions
    where id = p_posted_transaction_id and household_id = v_household_id
      and status = 'posted' and deleted_at is null
      and transaction_type = v_planned_type and flow_class = v_planned_flow
  ) then
    raise exception 'posted transaction has a different financial flow' using errcode = 'check_violation';
  end if;

  update public.recurring_occurrences set matched_transaction_id = p_posted_transaction_id
  where id = p_occurrence_id;
  update public.transactions set status = 'cancelled' where id = p_planned_transaction_id;
end;
$$;

revoke all on function public.link_recurring_occurrence(uuid, uuid, uuid) from public;
grant execute on function public.link_recurring_occurrence(uuid, uuid, uuid) to authenticated;
