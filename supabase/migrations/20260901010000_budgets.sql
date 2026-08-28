create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  month smallint not null check (month between 1 and 12),
  transaction_type text not null check (transaction_type in ('income', 'expense', 'saving')),
  category_id uuid not null references public.categories (id) on delete restrict,
  subcategory_id uuid null references public.subcategories (id) on delete restrict,
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (household_id, year, month, transaction_type, category_id, subcategory_id)
);

create index budgets_household_year_month_idx on public.budgets (household_id, year, month);
alter table public.budgets enable row level security;

create policy "budgets: owner select" on public.budgets for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "budgets: owner insert" on public.budgets for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "budgets: owner update" on public.budgets for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger budgets_set_updated_at before update on public.budgets
for each row execute function public.set_updated_at();

create or replace function public.budget_tenant_check()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.household_id = new.household_id
  ) then raise exception 'budgets.category_id belongs to a different household' using errcode = 'check_violation';
  elsif new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s
    where s.id = new.subcategory_id and s.category_id = new.category_id
  ) then raise exception 'budgets.subcategory_id does not belong to category_id' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger budget_tenant_check_trigger before insert or update on public.budgets
for each row execute function public.budget_tenant_check();

-- Budgets are retained as history. Clearing a cell writes amount=0; no DELETE policy is granted.
