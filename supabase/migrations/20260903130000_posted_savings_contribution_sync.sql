-- Keep the savings product's current contribution balance aligned with confirmed
-- recurring saving transactions. The status transition guard makes this idempotent.
create or replace function public.sync_posted_savings_contribution()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_savings_id uuid;
begin
  if old.status <> 'planned' or new.status <> 'posted' or new.deleted_at is not null
    or new.recurring_rule_id is null then return new; end if;

  select source_id into v_savings_id from public.recurring_rules
  where id = new.recurring_rule_id and source_type = 'saving' and transaction_type = 'saving';
  if v_savings_id is not null then
    update public.savings_accounts
    set current_savings = current_savings + new.amount
    where id = v_savings_id and household_id = new.household_id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger transactions_posted_savings_sync
after update of status on public.transactions
for each row execute function public.sync_posted_savings_contribution();
