create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) > 0),
  account_type text not null default 'checking'
    check (account_type in ('checking', 'savings', 'cma', 'other')),
  account_name text not null check (length(trim(account_name)) > 0),
  account_number text null,
  purpose text null,
  current_balance bigint not null default 0,
  owner_member_id uuid null references public.household_members (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'closed')),
  closed_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and closed_at is null) or status = 'closed')
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  issuer text not null check (length(trim(issuer)) > 0),
  card_type text not null check (card_type in ('credit', 'check')),
  issued_by text null,
  card_name text not null check (length(trim(card_name)) > 0),
  annual_fee bigint not null default 0 check (annual_fee >= 0),
  cancellable_from date null,
  closed_at date null,
  benefit_summary text null,
  owner_member_id uuid null references public.household_members (id) on delete set null,
  payment_method_id uuid null references public.payment_methods (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and closed_at is null) or status = 'closed')
);

create index accounts_household_status_idx on public.accounts (household_id, status);
create index cards_household_status_idx on public.cards (household_id, status);

alter table public.accounts enable row level security;
alter table public.cards enable row level security;

create policy "accounts: owner select" on public.accounts for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "accounts: owner insert" on public.accounts for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "accounts: owner update" on public.accounts for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create policy "cards: owner select" on public.cards for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "cards: owner insert" on public.cards for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "cards: owner update" on public.cards for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before update on public.cards
for each row execute function public.set_updated_at();

create or replace function public.account_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.owner_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.owner_member_id and m.household_id = new.household_id
  ) then
    raise exception 'accounts.owner_member_id belongs to a different household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.card_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.owner_member_id is not null and not exists (
    select 1 from public.household_members m
    where m.id = new.owner_member_id and m.household_id = new.household_id
  ) then
    raise exception 'cards.owner_member_id belongs to a different household'
      using errcode = 'check_violation';
  elsif new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p
    where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then
    raise exception 'cards.payment_method_id belongs to a different household'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger account_tenant_check_trigger before insert or update on public.accounts
for each row execute function public.account_tenant_check();
create trigger card_tenant_check_trigger before insert or update on public.cards
for each row execute function public.card_tenant_check();

-- Financial products are history-bearing masters. Closing changes status; no DELETE grant exists.
