-- Trigger writes must be allowed for the owner who updates the parent recurring rule.
create policy "recurring_rule_change_history: owner insert"
on public.recurring_rule_change_history for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

-- A product that has left the active state is historical and cannot be silently
-- reactivated, otherwise its terminal recurring rules would become inconsistent.
create or replace function public.product_status_is_terminal()
returns trigger language plpgsql as $$
begin
  if old.status <> 'active' and new.status = 'active' then
    raise exception 'inactive financial products cannot be reactivated' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger savings_accounts_status_terminal_trigger
before update of status on public.savings_accounts
for each row execute function public.product_status_is_terminal();

create trigger insurances_status_terminal_trigger
before update of status on public.insurances
for each row execute function public.product_status_is_terminal();

create trigger loans_status_terminal_trigger
before update of status on public.loans
for each row execute function public.product_status_is_terminal();
