create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) > 0),
  product_name text not null check (length(trim(product_name)) > 0),
  joined_at date not null,
  maturity_date date not null check (maturity_date >= joined_at),
  principal bigint not null check (principal > 0),
  annual_rate numeric(10, 6) not null check (annual_rate >= 0 and annual_rate <= 1),
  tax_rate numeric(10, 6) not null default 0.154 check (tax_rate >= 0 and tax_rate <= 1),
  owner_member_id uuid null references public.household_members (id) on delete set null,
  withdrawal_account_id uuid null references public.accounts (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'matured', 'terminated')),
  ended_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and ended_at is null) or status <> 'active')
);

create table public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) > 0),
  product_name text not null check (length(trim(product_name)) > 0),
  joined_at date not null,
  maturity_date date not null check (maturity_date >= joined_at),
  monthly_amount bigint not null check (monthly_amount > 0),
  annual_rate numeric(10, 6) not null check (annual_rate >= 0 and annual_rate <= 1),
  tax_rate numeric(10, 6) not null default 0.154 check (tax_rate >= 0 and tax_rate <= 1),
  interest_method text not null default 'simple' check (interest_method in ('simple', 'monthly_compound')),
  current_savings bigint not null default 0 check (current_savings >= 0),
  monthly_payment_day smallint null check (monthly_payment_day between 1 and 31),
  withdrawal_account_id uuid null references public.accounts (id) on delete set null,
  auto_recurring boolean not null default false,
  owner_member_id uuid null references public.household_members (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'matured', 'terminated')),
  ended_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not auto_recurring or monthly_payment_day is not null),
  check ((status = 'active' and ended_at is null) or status <> 'active')
);

create index deposits_household_status_idx on public.deposits (household_id, status);
create index savings_accounts_household_status_idx on public.savings_accounts (household_id, status);

alter table public.deposits enable row level security;
alter table public.savings_accounts enable row level security;

create policy "deposits: owner select" on public.deposits for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "deposits: owner insert" on public.deposits for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "deposits: owner update" on public.deposits for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create policy "savings_accounts: owner select" on public.savings_accounts for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "savings_accounts: owner insert" on public.savings_accounts for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "savings_accounts: owner update" on public.savings_accounts for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger deposits_set_updated_at before update on public.deposits
for each row execute function public.set_updated_at();
create trigger savings_accounts_set_updated_at before update on public.savings_accounts
for each row execute function public.set_updated_at();

create or replace function public.deposit_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.owner_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.owner_member_id and m.household_id = new.household_id
  ) then
    raise exception 'deposits.owner_member_id belongs to a different household' using errcode = 'check_violation';
  elsif new.withdrawal_account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = new.withdrawal_account_id and a.household_id = new.household_id
  ) then
    raise exception 'deposits.withdrawal_account_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.savings_account_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.owner_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.owner_member_id and m.household_id = new.household_id
  ) then
    raise exception 'savings_accounts.owner_member_id belongs to a different household' using errcode = 'check_violation';
  elsif new.withdrawal_account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = new.withdrawal_account_id and a.household_id = new.household_id
  ) then
    raise exception 'savings_accounts.withdrawal_account_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger deposit_tenant_check_trigger before insert or update on public.deposits
for each row execute function public.deposit_tenant_check();
create trigger savings_account_tenant_check_trigger before insert or update on public.savings_accounts
for each row execute function public.savings_account_tenant_check();

-- Interest and maturity amounts are derived at read time. Product masters retain source inputs only.
-- Products transition status rather than being deleted; intentionally no DELETE policies.
