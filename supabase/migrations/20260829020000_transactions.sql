create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_date date not null,
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
  income_group text null check (income_group in ('fixed', 'additional')),
  payment_method_id uuid null references public.payment_methods (id) on delete set null,
  category_id uuid null references public.categories (id) on delete set null,
  subcategory_id uuid null references public.subcategories (id) on delete set null,
  payer_member_id uuid null references public.household_members (id) on delete set null,
  beneficiary_member_id uuid null references public.household_members (id) on delete set null,
  -- Placeholder columns for later sprints -- no FK yet, tables don't exist:
  account_id uuid null,               -- FK added in Sprint 4 (accounts table)
  recurring_rule_id uuid null,        -- FK added in Sprint 2 (recurring_rules table)
  recurring_occurrence_id uuid null,  -- FK added in Sprint 2 (recurring_occurrences table)
  insurance_id uuid null,             -- FK added in Sprint 4 (insurances table)
  saving_account_id uuid null,        -- FK added in Sprint 4 (savings_accounts table)
  loan_id uuid null,                  -- FK added in Sprint 4 (loans table)
  amount bigint not null check (amount > 0),
  description text not null,
  memo text null,
  include_in_budget boolean not null default true,
  needs_review boolean not null default false,
  parent_transaction_id uuid null references public.transactions (id) on delete set null,
  status text not null default 'posted' check (status in ('planned', 'posted', 'skipped', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index transactions_household_date_idx on public.transactions (household_id, transaction_date);
create index transactions_household_category_date_idx
  on public.transactions (household_id, category_id, transaction_date);
create index transactions_household_cost_behavior_date_idx
  on public.transactions (household_id, cost_behavior, transaction_date);
create index transactions_household_subcategory_date_idx
  on public.transactions (household_id, subcategory_id, transaction_date);
create index transactions_household_payment_method_date_idx
  on public.transactions (household_id, payment_method_id, transaction_date);
create index transactions_household_payer_date_idx
  on public.transactions (household_id, payer_member_id, transaction_date);
create index transactions_household_beneficiary_date_idx
  on public.transactions (household_id, beneficiary_member_id, transaction_date);

alter table public.transactions enable row level security;

create policy "transactions: owner select"
on public.transactions for select
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "transactions: owner insert"
on public.transactions for insert
to authenticated
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "transactions: owner update"
on public.transactions for update
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
)
with check (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);

create policy "transactions: owner delete"
on public.transactions for delete
to authenticated
using (
  household_id in (select id from public.households where owner_user_id = (select auth.uid()))
);
