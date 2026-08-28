-- Product-backed rules are unique per transaction flow. Loans deliberately own two rules:
-- principal and interest must never be collapsed into consumption (PRD §5.6/§23.7).
create unique index recurring_rules_one_product_flow
  on public.recurring_rules (household_id, source_type, source_id, transaction_type)
  where source_id is not null;

create or replace function public.recurring_rule_source_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.source_type = 'insurance' and (
    new.source_id is null or not exists (
      select 1 from public.insurances i where i.id = new.source_id and i.household_id = new.household_id
    )
  ) then raise exception 'recurring_rules.source_id is not an insurance in this household' using errcode = 'check_violation';
  elsif new.source_type = 'saving' and (
    new.source_id is null or not exists (
      select 1 from public.savings_accounts s where s.id = new.source_id and s.household_id = new.household_id
    )
  ) then raise exception 'recurring_rules.source_id is not a savings account in this household' using errcode = 'check_violation';
  elsif new.source_type = 'loan' and (
    new.source_id is null or not exists (
      select 1 from public.loans l where l.id = new.source_id and l.household_id = new.household_id
    )
  ) then raise exception 'recurring_rules.source_id is not a loan in this household' using errcode = 'check_violation';
  elsif new.source_type in ('manual', 'subscription', 'salary') and new.source_id is not null then
    raise exception 'manual recurring source cannot reference a product' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger recurring_rule_source_tenant_check_trigger
before insert or update on public.recurring_rules
for each row execute function public.recurring_rule_source_tenant_check();

create or replace function public.create_savings_recurring_rule()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' and new.auto_recurring and new.monthly_payment_day is not null then
    insert into public.recurring_rules (
      household_id, source_type, source_id, start_date, end_date, frequency, interval_count,
      day_of_month, default_amount, transaction_type, flow_class, payer_member_id,
      description, include_in_budget
    ) values (
      new.household_id, 'saving', new.id, new.joined_at, new.maturity_date, 'monthly', 1,
      new.monthly_payment_day, new.monthly_amount, 'saving', 'saving', new.owner_member_id,
      new.product_name || ' 월 납입', true
    ) on conflict (household_id, source_type, source_id, transaction_type)
      where source_id is not null do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.create_insurance_recurring_rule()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' and new.monthly_premium > 0 and new.payment_day is not null then
    insert into public.recurring_rules (
      household_id, source_type, source_id, start_date, end_date, frequency, interval_count,
      day_of_month, default_amount, transaction_type, flow_class, cost_behavior,
      payment_method_id, beneficiary_member_id, description, include_in_budget
    ) values (
      new.household_id, 'insurance', new.id, new.joined_at,
      coalesce(new.payment_maturity_date, new.coverage_maturity_date), 'monthly', 1,
      new.payment_day, new.monthly_premium, 'expense', 'consumption', 'fixed',
      new.payment_method_id, new.insured_member_id, new.product_name || ' 보험료', true
    ) on conflict (household_id, source_type, source_id, transaction_type)
      where source_id is not null do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.create_loan_recurring_rules()
returns trigger language plpgsql as $$
declare
  v_term_months integer;
  v_amortizing_months integer;
  v_monthly_rate numeric;
  v_first_interest bigint;
  v_principal_default bigint;
  v_equal_payment numeric;
begin
  if new.status <> 'active' then return new; end if;
  v_term_months := greatest(1, (extract(year from age(new.maturity_date, new.first_payment_date))::integer * 12)
    + extract(month from age(new.maturity_date, new.first_payment_date))::integer + 1);
  v_amortizing_months := greatest(1, v_term_months - new.grace_months);
  v_monthly_rate := new.annual_rate / 12;
  v_first_interest := round(new.original_amount * v_monthly_rate);
  if new.repayment_method = 'bullet' then
    v_principal_default := new.original_amount;
  elsif new.repayment_method = 'equal_principal' or v_monthly_rate = 0 then
    v_principal_default := greatest(1, round(new.original_amount::numeric / v_amortizing_months));
  else
    v_equal_payment := new.original_amount * v_monthly_rate * power(1 + v_monthly_rate, v_amortizing_months)
      / (power(1 + v_monthly_rate, v_amortizing_months) - 1);
    v_principal_default := greatest(1, round(v_equal_payment - v_first_interest));
  end if;

  insert into public.recurring_rules (
    household_id, source_type, source_id, start_date, end_date, frequency, interval_count,
    day_of_month, default_amount, transaction_type, flow_class, payer_member_id,
    description, include_in_budget
  ) values (
    new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1,
    extract(day from new.first_payment_date), v_principal_default, 'debt_principal', 'debt_principal',
    new.owner_member_id, new.loan_name || ' 원금', false
  ) on conflict (household_id, source_type, source_id, transaction_type)
    where source_id is not null do nothing;

  if v_first_interest > 0 then
    insert into public.recurring_rules (
      household_id, source_type, source_id, start_date, end_date, frequency, interval_count,
      day_of_month, default_amount, transaction_type, flow_class, cost_behavior,
      payer_member_id, description, include_in_budget
    ) values (
      new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1,
      extract(day from new.first_payment_date), v_first_interest, 'finance_cost', 'finance_cost', 'fixed',
      new.owner_member_id, new.loan_name || ' 이자', true
    ) on conflict (household_id, source_type, source_id, transaction_type)
      where source_id is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger savings_create_recurring_trigger after insert or update on public.savings_accounts
for each row execute function public.create_savings_recurring_rule();
create trigger insurance_create_recurring_trigger after insert or update on public.insurances
for each row execute function public.create_insurance_recurring_rule();
create trigger loan_create_recurring_trigger after insert or update on public.loans
for each row execute function public.create_loan_recurring_rules();

create or replace function public.end_product_recurring_rules()
returns trigger language plpgsql as $$
declare
  v_source_type text;
  v_effective_date date;
  v_rule_ids uuid[];
begin
  if old.status <> 'active' or new.status = 'active' then return new; end if;
  v_source_type := case tg_table_name
    when 'savings_accounts' then 'saving'
    when 'insurances' then 'insurance'
    when 'loans' then 'loan'
  end;
  v_effective_date := coalesce(new.ended_at, current_date);
  select array_agg(id) into v_rule_ids from public.recurring_rules
    where household_id = new.household_id and source_type = v_source_type
      and source_id = new.id and status <> 'ended';
  update public.recurring_rules set status = 'ended', end_date = greatest(start_date, v_effective_date)
    where id = any(coalesce(v_rule_ids, array[]::uuid[]));
  update public.transactions set status = 'skipped'
    where recurring_rule_id = any(coalesce(v_rule_ids, array[]::uuid[]))
      and transaction_date >= v_effective_date and status = 'planned' and deleted_at is null;
  return new;
end;
$$;

create trigger savings_end_recurring_trigger after update of status on public.savings_accounts
for each row execute function public.end_product_recurring_rules();
create trigger insurance_end_recurring_trigger after update of status on public.insurances
for each row execute function public.end_product_recurring_rules();
create trigger loan_end_recurring_trigger after update of status on public.loans
for each row execute function public.end_product_recurring_rules();

-- Backfill products created before these triggers existed. The no-op assignments deliberately
-- fire the same trigger path used by future writes, keeping one source of truth for rule shape.
update public.savings_accounts set auto_recurring = auto_recurring where status = 'active';
update public.insurances set monthly_premium = monthly_premium where status = 'active';
update public.loans set original_amount = original_amount where status = 'active';
