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
  if tg_op = 'UPDATE' and old.transaction_type = 'expense' and old.flow_class = 'consumption'
    and (new.amount is distinct from old.amount or new.transaction_type is distinct from old.transaction_type or new.flow_class is distinct from old.flow_class or new.deleted_at is distinct from old.deleted_at) then
    select coalesce(sum(amount), 0) into refunded_amount
    from public.transactions
    where parent_transaction_id = new.id
      and transaction_type = 'refund'
      and status = 'posted'
      and deleted_at is null;
    if new.transaction_type <> 'expense' or new.flow_class <> 'consumption' or new.deleted_at is not null then
      if refunded_amount > 0 then raise exception 'cannot change a parent transaction while posted refunds exist'; end if;
    elsif refunded_amount > new.amount then
      raise exception 'parent transaction amount cannot be less than posted refunds';
    end if;
  end if;

  if new.transaction_type <> 'refund' or new.parent_transaction_id is null or new.deleted_at is not null then
    return new;
  end if;
  select amount into parent_amount
  from public.transactions
  where id = new.parent_transaction_id and household_id = new.household_id
    and transaction_type = 'expense' and flow_class = 'consumption' and deleted_at is null;
  if parent_amount is null then raise exception 'refund parent must be an active consumption expense'; end if;
  select coalesce(sum(amount), 0) into refunded_amount
  from public.transactions
  where parent_transaction_id = new.parent_transaction_id and transaction_type = 'refund'
    and status = 'posted' and deleted_at is null and id <> new.id;
  if refunded_amount + new.amount > parent_amount then
    raise exception 'refund total cannot exceed parent transaction amount';
  end if;
  return new;
end;
$$;
