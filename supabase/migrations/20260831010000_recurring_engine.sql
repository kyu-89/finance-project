-- Sprint 2 recurring engine foundations (PRD §5.5).
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source_type text not null default 'manual'
    check (source_type in ('insurance', 'saving', 'loan', 'subscription', 'salary', 'manual')),
  source_id uuid null,
  start_date date not null,
  end_date date null check (end_date is null or end_date >= start_date),
  frequency text not null
    check (frequency in ('monthly', 'weekly', 'yearly', 'custom')),
  interval_count integer not null default 1 check (interval_count > 0),
  day_of_month smallint null check (day_of_month between 1 and 31),
  default_amount bigint not null check (default_amount > 0),
  transaction_type text not null
    check (transaction_type in (
      'income', 'expense', 'saving', 'investment', 'debt_principal',
      'finance_cost', 'transfer', 'asset_adjustment', 'refund'
    )),
  flow_class text not null
    check (flow_class in (
      'cash_in', 'consumption', 'saving', 'investment', 'debt_principal',
      'finance_cost', 'transfer', 'adjustment'
    )),
  cost_behavior text null check (cost_behavior in ('fixed', 'variable')),
  check (
    (transaction_type in ('income', 'refund') and flow_class = 'cash_in') or
    (transaction_type = 'expense' and flow_class = 'consumption') or
    (transaction_type = 'saving' and flow_class = 'saving') or
    (transaction_type = 'investment' and flow_class = 'investment') or
    (transaction_type = 'debt_principal' and flow_class = 'debt_principal') or
    (transaction_type = 'finance_cost' and flow_class = 'finance_cost') or
    (transaction_type = 'transfer' and flow_class = 'transfer') or
    (transaction_type = 'asset_adjustment' and flow_class = 'adjustment')
  ),
  check (cost_behavior is null or transaction_type in ('expense', 'finance_cost')),
  category_id uuid null references public.categories (id) on delete set null,
  subcategory_id uuid null references public.subcategories (id) on delete set null,
  payment_method_id uuid null references public.payment_methods (id) on delete set null,
  payer_member_id uuid null references public.household_members (id) on delete set null,
  beneficiary_member_id uuid null references public.household_members (id) on delete set null,
  description text not null,
  memo text null,
  include_in_budget boolean not null default true,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  auto_generate boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recurring_rule_id uuid not null references public.recurring_rules (id) on delete cascade,
  occurrence_date date not null,
  matched_transaction_id uuid null references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_rule_id, occurrence_date)
);

create index recurring_rules_household_status_idx
  on public.recurring_rules (household_id, status, start_date);
create index recurring_occurrences_household_date_idx
  on public.recurring_occurrences (household_id, occurrence_date);

alter table public.transactions
  add constraint transactions_recurring_rule_id_fkey
  foreign key (recurring_rule_id) references public.recurring_rules (id) on delete set null,
  add constraint transactions_recurring_occurrence_id_fkey
  foreign key (recurring_occurrence_id) references public.recurring_occurrences (id) on delete set null;

create unique index transactions_one_live_row_per_occurrence
  on public.transactions (recurring_occurrence_id)
  where recurring_occurrence_id is not null and deleted_at is null;

alter table public.recurring_rules enable row level security;
alter table public.recurring_occurrences enable row level security;

create policy "recurring_rules: owner select" on public.recurring_rules for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "recurring_rules: owner insert" on public.recurring_rules for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "recurring_rules: owner update" on public.recurring_rules for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create policy "recurring_occurrences: owner select" on public.recurring_occurrences for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "recurring_occurrences: owner insert" on public.recurring_occurrences for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "recurring_occurrences: owner update" on public.recurring_occurrences for update to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())))
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger recurring_rules_set_updated_at before update on public.recurring_rules
for each row execute function public.set_updated_at();
create trigger recurring_occurrences_set_updated_at before update on public.recurring_occurrences
for each row execute function public.set_updated_at();

-- RLS limits access, while this trigger independently protects referential integrity for
-- service-role/batch writers and catches same-household category/subcategory mismatches.
create or replace function public.recurring_rule_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id
  ) then raise exception 'recurring_rules.category_id belongs to a different household' using errcode = 'check_violation';
  elsif new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s join public.categories c on c.id = s.category_id
    where s.id = new.subcategory_id and c.household_id = new.household_id
  ) then raise exception 'recurring_rules.subcategory_id belongs to a different household' using errcode = 'check_violation';
  elsif new.subcategory_id is not null and new.category_id is not null and not exists (
    select 1 from public.subcategories s where s.id = new.subcategory_id and s.category_id = new.category_id
  ) then raise exception 'recurring_rules.subcategory_id does not belong to category_id' using errcode = 'check_violation';
  elsif new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then raise exception 'recurring_rules.payment_method_id belongs to a different household' using errcode = 'check_violation';
  elsif new.payer_member_id is not null and not exists (
    select 1 from public.household_members m where m.id = new.payer_member_id and m.household_id = new.household_id
  ) then raise exception 'recurring_rules.payer_member_id belongs to a different household' using errcode = 'check_violation';
  elsif new.beneficiary_member_id is not null and not exists (
    select 1 from public.household_members m where m.id = new.beneficiary_member_id and m.household_id = new.household_id
  ) then raise exception 'recurring_rules.beneficiary_member_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger recurring_rule_tenant_check_trigger before insert or update on public.recurring_rules
for each row execute function public.recurring_rule_tenant_check();

create or replace function public.recurring_occurrence_tenant_check()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.recurring_rules r where r.id = new.recurring_rule_id and r.household_id = new.household_id
  ) then raise exception 'recurring_occurrences.recurring_rule_id belongs to a different household' using errcode = 'check_violation';
  elsif new.matched_transaction_id is not null and not exists (
    select 1 from public.transactions t where t.id = new.matched_transaction_id and t.household_id = new.household_id
  ) then raise exception 'recurring_occurrences.matched_transaction_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger recurring_occurrence_tenant_check_trigger before insert or update on public.recurring_occurrences
for each row execute function public.recurring_occurrence_tenant_check();

create or replace function public.transactions_recurring_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.recurring_rule_id is not null and not exists (
    select 1 from public.recurring_rules r where r.id = new.recurring_rule_id and r.household_id = new.household_id
  ) then raise exception 'transactions.recurring_rule_id belongs to a different household' using errcode = 'check_violation';
  elsif new.recurring_occurrence_id is not null and not exists (
    select 1 from public.recurring_occurrences o
    where o.id = new.recurring_occurrence_id and o.household_id = new.household_id
      and (new.recurring_rule_id is null or o.recurring_rule_id = new.recurring_rule_id)
  ) then raise exception 'transactions.recurring_occurrence_id is inconsistent' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger transactions_recurring_tenant_check_trigger before insert or update on public.transactions
for each row execute function public.transactions_recurring_tenant_check();

-- Rules and occurrences are lifecycle-managed records; no DELETE policy is intentionally granted.
