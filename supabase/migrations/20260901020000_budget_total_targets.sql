alter table public.budgets alter column category_id drop not null;
alter table public.budgets add constraint budgets_expense_requires_category
  check (transaction_type <> 'expense' or category_id is not null);

create or replace function public.budget_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.household_id = new.household_id
  ) then raise exception 'budgets.category_id belongs to a different household' using errcode = 'check_violation';
  elsif new.subcategory_id is not null and (
    new.category_id is null or not exists (
      select 1 from public.subcategories s
      where s.id = new.subcategory_id and s.category_id = new.category_id
    )
  ) then raise exception 'budgets.subcategory_id does not belong to category_id' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
