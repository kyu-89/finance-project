create table public.loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  institution_name text not null check (length(trim(institution_name)) > 0),
  loan_name text not null check (length(trim(loan_name)) > 0),
  original_amount bigint not null check (original_amount > 0),
  annual_rate numeric(10, 6) not null check (annual_rate >= 0 and annual_rate <= 1),
  repayment_method text not null check (repayment_method in ('equal_payment', 'equal_principal', 'bullet')),
  loan_date date not null,
  first_payment_date date not null,
  maturity_date date not null,
  grace_months smallint not null default 0 check (grace_months >= 0),
  owner_member_id uuid null references public.household_members (id) on delete set null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'paid_off', 'refinanced')),
  ended_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_payment_date >= loan_date and maturity_date >= first_payment_date),
  check ((status = 'active' and ended_at is null) or status <> 'active')
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  loan_id uuid not null references public.loans (id) on delete restrict,
  installment integer not null check (installment > 0),
  payment_date date not null,
  principal_payment bigint not null check (principal_payment >= 0),
  interest_payment bigint not null check (interest_payment >= 0),
  total_payment bigint not null check (total_payment >= 0),
  cumulative_payment bigint not null check (cumulative_payment >= 0),
  remaining_balance bigint not null check (remaining_balance >= 0),
  payment_type text not null default 'scheduled' check (payment_type in ('scheduled', 'early', 'refinance', 'payoff')),
  memo text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_payment = principal_payment + interest_payment)
);

create table public.insurances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  insured_member_id uuid null references public.household_members (id) on delete set null,
  insurer_name text not null check (length(trim(insurer_name)) > 0),
  insurance_type text not null check (length(trim(insurance_type)) > 0),
  product_name text not null check (length(trim(product_name)) > 0),
  coverage_summary text null,
  payment_method_id uuid null references public.payment_methods (id) on delete set null,
  payment_method_note text null,
  joined_at date not null,
  payment_maturity_date date null,
  coverage_maturity_date date null,
  monthly_premium bigint not null default 0 check (monthly_premium >= 0),
  payment_day smallint null check (payment_day between 1 and 31),
  contact text null,
  memo text null,
  status text not null default 'active' check (status in ('active', 'terminated', 'free')),
  ended_at date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and ended_at is null) or status <> 'active')
);

create index loans_household_status_idx on public.loans (household_id, status);
create index loan_payments_loan_date_idx on public.loan_payments (loan_id, payment_date);
create index insurances_household_status_idx on public.insurances (household_id, status);

alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.insurances enable row level security;

create policy "loans: owner select" on public.loans for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "loans: owner insert" on public.loans for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "loans: owner update" on public.loans for update to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "loan_payments: owner select" on public.loan_payments for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "loan_payments: owner insert" on public.loan_payments for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "loan_payments: owner update" on public.loan_payments for update to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "insurances: owner select" on public.insurances for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "insurances: owner insert" on public.insurances for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "insurances: owner update" on public.insurances for update to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid()))) with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger loans_set_updated_at before update on public.loans for each row execute function public.set_updated_at();
create trigger loan_payments_set_updated_at before update on public.loan_payments for each row execute function public.set_updated_at();
create trigger insurances_set_updated_at before update on public.insurances for each row execute function public.set_updated_at();

create or replace function public.loan_tenant_check() returns trigger language plpgsql as $$
begin
  if new.owner_member_id is not null and not exists (select 1 from public.household_members m where m.id = new.owner_member_id and m.household_id = new.household_id) then
    raise exception 'loans.owner_member_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create or replace function public.loan_payment_tenant_check() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.loans l where l.id = new.loan_id and l.household_id = new.household_id) then
    raise exception 'loan_payments.loan_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create or replace function public.insurance_tenant_check() returns trigger language plpgsql as $$
begin
  if new.insured_member_id is not null and not exists (select 1 from public.household_members m where m.id = new.insured_member_id and m.household_id = new.household_id) then
    raise exception 'insurances.insured_member_id belongs to a different household' using errcode = 'check_violation';
  elsif new.payment_method_id is not null and not exists (select 1 from public.payment_methods p where p.id = new.payment_method_id and p.household_id = new.household_id) then
    raise exception 'insurances.payment_method_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger loan_tenant_check_trigger before insert or update on public.loans for each row execute function public.loan_tenant_check();
create trigger loan_payment_tenant_check_trigger before insert or update on public.loan_payments for each row execute function public.loan_payment_tenant_check();
create trigger insurance_tenant_check_trigger before insert or update on public.insurances for each row execute function public.insurance_tenant_check();

-- Products and repayment history are retained; intentionally no DELETE policies.
