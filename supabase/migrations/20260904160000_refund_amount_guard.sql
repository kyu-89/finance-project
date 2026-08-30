create or replace function public.validate_refund_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_amount bigint;
  refunded_amount bigint;
begin
  if new.transaction_type <> 'refund' or new.parent_transaction_id is null or new.deleted_at is not null then
    return new;
  end if;

  select amount into parent_amount
  from public.transactions
  where id = new.parent_transaction_id
    and household_id = new.household_id
    and transaction_type = 'expense'
    and flow_class = 'consumption'
    and deleted_at is null;

  if parent_amount is null then
    raise exception 'refund parent must be an active consumption expense';
  end if;

  select coalesce(sum(amount), 0) into refunded_amount
  from public.transactions
  where parent_transaction_id = new.parent_transaction_id
    and transaction_type = 'refund'
    and status = 'posted'
    and deleted_at is null
    and id <> new.id;

  if refunded_amount + new.amount > parent_amount then
    raise exception 'refund total cannot exceed parent transaction amount';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_refund_amount_guard on public.transactions;
create constraint trigger transactions_refund_amount_guard
after insert or update of amount, parent_transaction_id, transaction_type, status, deleted_at
on public.transactions
deferrable initially immediate
for each row execute function public.validate_refund_amount();
