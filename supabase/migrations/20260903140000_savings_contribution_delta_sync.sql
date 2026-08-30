-- Reconcile savings contributions for confirmation, edits, soft-delete and restore.
-- Applying the delta makes repeated updates idempotent and preserves the ledger as source of truth.
create or replace function public.sync_posted_savings_contribution()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_savings_id uuid;
  v_old_contribution bigint := 0;
  v_new_contribution bigint := 0;
begin
  if new.recurring_rule_id is null then return new; end if;
  select source_id into v_savings_id from public.recurring_rules
  where id = new.recurring_rule_id and source_type = 'saving' and transaction_type = 'saving';
  if v_savings_id is null then return new; end if;

  if old.status = 'posted' and old.deleted_at is null then v_old_contribution := old.amount; end if;
  if new.status = 'posted' and new.deleted_at is null then v_new_contribution := new.amount; end if;
  if v_old_contribution <> v_new_contribution then
    update public.savings_accounts
    set current_savings = greatest(0, current_savings + v_new_contribution - v_old_contribution)
    where id = v_savings_id and household_id = new.household_id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_posted_savings_sync on public.transactions;
create trigger transactions_posted_savings_sync
after update of status, amount, deleted_at on public.transactions
for each row execute function public.sync_posted_savings_contribution();
