-- 1. updated_at maintenance -------------------------------------------------
-- Every table carries an updated_at column that nothing has ever updated, so it
-- has been permanently equal to created_at. Fix it once, centrally.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger subcategories_set_updated_at
  before update on public.subcategories
  for each row execute function public.set_updated_at();

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- 2. One 'self' member per household ----------------------------------------
-- Sprint 0's ensureSelfMember has a best-effort re-check because no DB constraint
-- could distinguish a concurrent-insert race from a real failure. A PARTIAL unique
-- index on member_type='self' fixes that without breaking PRD §3.1's multi-child
-- model (자녀1/자녀2 both legitimately have member_type='child').
create unique index household_members_one_self_per_household
  on public.household_members (household_id)
  where member_type = 'self';

-- 3. Tenant-consistency on transactions' cross-table FKs ---------------------
-- FK validation runs independently of RLS, so a caller who learns another household's
-- category/payment-method/member UUID could reference it from their own transaction.
-- No read leak results (the target row's own RLS still blocks reads), but it is a
-- referential-integrity crack that programmatic writers (Sprint 2's recurring engine)
-- could widen. Reject it at write time.
create or replace function public.transactions_tenant_check()
returns trigger
language plpgsql
as $$
declare
  mismatch_column text;
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.household_id = new.household_id
  ) then
    mismatch_column := 'category_id';
  elsif new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s
    join public.categories c on c.id = s.category_id
    where s.id = new.subcategory_id and c.household_id = new.household_id
  ) then
    mismatch_column := 'subcategory_id';
  elsif new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p
    where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then
    mismatch_column := 'payment_method_id';
  elsif new.payer_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.payer_member_id and m.household_id = new.household_id
  ) then
    mismatch_column := 'payer_member_id';
  elsif new.beneficiary_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.beneficiary_member_id and m.household_id = new.household_id
  ) then
    mismatch_column := 'beneficiary_member_id';
  elsif new.parent_transaction_id is not null and not exists (
    select 1 from public.transactions t
    where t.id = new.parent_transaction_id and t.household_id = new.household_id
  ) then
    mismatch_column := 'parent_transaction_id';
  end if;

  if mismatch_column is not null then
    raise exception
      'transactions.% references a row belonging to a different household', mismatch_column
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Also enforce that subcategory_id actually belongs to category_id when both are set --
-- a stale client select could otherwise pair them arbitrarily within one household.
create or replace function public.transactions_subcategory_check()
returns trigger
language plpgsql
as $$
begin
  if new.subcategory_id is not null and new.category_id is not null and not exists (
    select 1 from public.subcategories s
    where s.id = new.subcategory_id and s.category_id = new.category_id
  ) then
    raise exception 'transactions.subcategory_id does not belong to transactions.category_id'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger transactions_tenant_check_trigger
  before insert or update on public.transactions
  for each row execute function public.transactions_tenant_check();

create trigger transactions_subcategory_check_trigger
  before insert or update on public.transactions
  for each row execute function public.transactions_subcategory_check();
