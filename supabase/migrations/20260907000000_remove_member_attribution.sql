-- The household ledger is a shared source of truth. Personal ownership, payer, and beneficiary
-- dimensions made balances and reports diverge, so remove them from both writes and aggregates.
-- The household_members roster itself (Settings > 가족 구성원) is removed along with every
-- column/index/trigger-check that referenced it. `households` (the tenant/ownership boundary)
-- and its owner_user_id-based RLS policies are untouched.

drop function if exists public.dashboard_home_summary(uuid, date, date, date, date, uuid, boolean);
drop function if exists public.dashboard_income_summary(uuid, date, date, date, date, uuid, boolean);
drop function if exists public.dashboard_payment_summary(uuid, date, date, uuid, boolean);
drop function if exists public.dashboard_monthly_subcategory_summary(uuid, date, date, uuid, boolean);

create or replace function public.transactions_tenant_check()
returns trigger language plpgsql as $$
declare
  mismatch_column text;
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id
  ) then
    mismatch_column := 'category_id';
  elsif new.subcategory_id is not null and not exists (
    select 1 from public.subcategories s join public.categories c on c.id = s.category_id
    where s.id = new.subcategory_id and c.household_id = new.household_id
  ) then
    mismatch_column := 'subcategory_id';
  elsif new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then
    mismatch_column := 'payment_method_id';
  elsif new.parent_transaction_id is not null and not exists (
    select 1 from public.transactions t where t.id = new.parent_transaction_id and t.household_id = new.household_id
  ) then
    mismatch_column := 'parent_transaction_id';
  end if;
  if mismatch_column is not null then
    raise exception 'transactions.% references a row belonging to a different household', mismatch_column using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

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
  end if;
  return new;
end;
$$;

create or replace function public.account_tenant_check()
returns trigger language plpgsql as $$ begin return new; end; $$;

create or replace function public.card_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then raise exception 'cards.payment_method_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.deposit_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.withdrawal_account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.withdrawal_account_id and a.household_id = new.household_id
  ) then raise exception 'deposits.withdrawal_account_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.savings_account_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.withdrawal_account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.withdrawal_account_id and a.household_id = new.household_id
  ) then raise exception 'savings_accounts.withdrawal_account_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.loan_tenant_check()
returns trigger language plpgsql as $$ begin return new; end; $$;

create or replace function public.asset_tenant_check()
returns trigger language plpgsql as $$ begin return new; end; $$;

create or replace function public.insurance_tenant_check()
returns trigger language plpgsql as $$
begin
  if new.payment_method_id is not null and not exists (
    select 1 from public.payment_methods p where p.id = new.payment_method_id and p.household_id = new.household_id
  ) then raise exception 'insurances.payment_method_id belongs to a different household' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.create_savings_recurring_rule()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' and new.auto_recurring and new.monthly_payment_day is not null then
    insert into public.recurring_rules (
      household_id, source_type, source_id, start_date, end_date, frequency, interval_count,
      day_of_month, default_amount, transaction_type, flow_class, description, include_in_budget
    ) values (
      new.household_id, 'saving', new.id, new.joined_at, new.maturity_date, 'monthly', 1,
      new.monthly_payment_day, new.monthly_amount, 'saving', 'saving', new.product_name || ' 적금 납입', true
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
      payment_method_id, description, include_in_budget
    ) values (
      new.household_id, 'insurance', new.id, new.joined_at,
      coalesce(new.payment_maturity_date, new.coverage_maturity_date), 'monthly', 1,
      new.payment_day, new.monthly_premium, 'expense', 'consumption', 'fixed',
      new.payment_method_id, new.product_name || ' 보험료', true
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
  v_term_months := greatest(1, (extract(year from age(new.maturity_date, new.first_payment_date))::integer * 12) + extract(month from age(new.maturity_date, new.first_payment_date))::integer + 1);
  v_amortizing_months := greatest(1, v_term_months - new.grace_months);
  v_monthly_rate := new.annual_rate / 12;
  v_first_interest := round(new.original_amount * v_monthly_rate);
  if new.repayment_method = 'bullet' then v_principal_default := new.original_amount;
  elsif new.repayment_method = 'equal_principal' or v_monthly_rate = 0 then v_principal_default := greatest(1, round(new.original_amount::numeric / v_amortizing_months));
  else v_equal_payment := new.original_amount * v_monthly_rate * power(1 + v_monthly_rate, v_amortizing_months) / (power(1 + v_monthly_rate, v_amortizing_months) - 1); v_principal_default := greatest(1, round(v_equal_payment - v_first_interest));
  end if;
  insert into public.recurring_rules (household_id, source_type, source_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, description, include_in_budget)
  values (new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1, extract(day from new.first_payment_date), v_principal_default, 'debt_principal', 'debt_principal', new.loan_name || ' 원금', false)
  on conflict (household_id, source_type, source_id, transaction_type) where source_id is not null do nothing;
  if v_first_interest > 0 then
    insert into public.recurring_rules (household_id, source_type, source_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, description, include_in_budget)
    values (new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1, extract(day from new.first_payment_date), v_first_interest, 'finance_cost', 'finance_cost', 'fixed', new.loan_name || ' 이자', true)
    on conflict (household_id, source_type, source_id, transaction_type) where source_id is not null do nothing;
  end if;
  return new;
end;
$$;

-- Per-member snapshot rows are legacy projections. Keep the household rows only.
delete from public.asset_value_history where member_id is not null;
delete from public.monthly_asset_snapshots where member_id is not null;
drop index if exists public.monthly_asset_snapshots_household_month_member_key;
drop index if exists public.asset_value_history_household_month_member_key;
drop index if exists public.monthly_asset_snapshots_member_month_idx;
drop index if exists public.asset_value_history_member_month_idx;
alter table public.monthly_asset_snapshots drop column if exists member_id;
alter table public.asset_value_history drop column if exists member_id;
create unique index if not exists monthly_asset_snapshots_household_month_key on public.monthly_asset_snapshots (household_id, snapshot_month);
create unique index if not exists asset_value_history_household_month_key on public.asset_value_history (household_id, snapshot_month);

-- Replace the trigger body now that the legacy member column is gone.
create or replace function public.sync_asset_value_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.asset_value_history where household_id = new.household_id and snapshot_month = new.snapshot_month;
  insert into public.asset_value_history (household_id, snapshot_month, total_assets, source)
  values (new.household_id, new.snapshot_month, new.total_assets, 'snapshot');
  return new;
end;
$$;

drop index if exists public.transactions_household_payer_date_idx;
drop index if exists public.transactions_household_beneficiary_date_idx;
drop index if exists public.payment_methods_owner_member_idx;
alter table public.transactions drop column if exists payer_member_id, drop column if exists beneficiary_member_id;
alter table public.recurring_rules drop column if exists payer_member_id, drop column if exists beneficiary_member_id;
alter table public.accounts drop column if exists owner_member_id;
alter table public.cards drop column if exists owner_member_id, drop column if exists issued_by;
alter table public.deposits drop column if exists owner_member_id;
alter table public.savings_accounts drop column if exists owner_member_id;
alter table public.loans drop column if exists owner_member_id;
alter table public.assets drop column if exists owner_member_id;
alter table public.payment_methods drop column if exists owner_member_id;
alter table public.insurances drop column if exists insured_member_id;
alter table public.transaction_support_details drop column if exists beneficiary_member_id;
alter table public.transaction_event_details drop column if exists related_member_id;

-- The roster itself (Settings > 가족 구성원) is removed. `linked_user_id` was a vestigial,
-- entirely unused invite/access-sharing column that dies with the table; this app has no
-- separate multi-user access-control feature. Every FK/column referencing this table has
-- already been dropped above, and dropping the table cascades away its own indexes,
-- triggers, and RLS policies (household_members_one_self_per_household,
-- household_members_set_updated_at, "household_members: owner *").
drop table if exists public.household_members cascade;

create function public.dashboard_home_summary(
  p_household_id uuid, p_from date, p_to date, p_month_start date, p_month_end date
) returns jsonb language sql stable security invoker set search_path = public as $$
with filtered as (
  select t.*, parent.category_id as parent_category_id, parent.payment_method_id as parent_payment_method_id, parent.cost_behavior as parent_cost_behavior,
    coalesce(t.source_month, to_char(t.transaction_date, 'YYYY-MM')) as report_month
  from public.transactions t
  left join public.transactions parent on parent.id = t.parent_transaction_id and parent.household_id = t.household_id and parent.deleted_at is null
  where t.household_id = p_household_id and t.deleted_at is null
    and coalesce(t.source_month, to_char(t.transaction_date, 'YYYY-MM')) between to_char(p_from, 'YYYY-MM') and to_char(p_to, 'YYYY-MM')
), normalized as (
  select filtered.*, case when transaction_type = 'refund' then -amount else amount end as signed_amount,
    coalesce(category_id, parent_category_id) as effective_category_id,
    coalesce(payment_method_id, parent_payment_method_id) as effective_payment_method_id,
    coalesce(cost_behavior, parent_cost_behavior) as effective_cost_behavior
  from filtered
), monthly as (
  select report_month as month,
    coalesce(sum(amount) filter (where status = 'posted' and transaction_type = 'income'), 0) as income,
    coalesce(sum(signed_amount) filter (where status = 'posted' and (flow_class = 'consumption' or transaction_type = 'refund')), 0) as consumption,
    coalesce(sum(signed_amount) filter (where status = 'posted' and (flow_class = 'consumption' or transaction_type = 'refund') and effective_cost_behavior = 'fixed'), 0) as fixed_consumption,
    coalesce(sum(signed_amount) filter (where status = 'posted' and (flow_class = 'consumption' or transaction_type = 'refund') and effective_cost_behavior = 'variable'), 0) as variable_consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'saving'), 0) as saving,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'investment'), 0) as investment,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'debt_principal'), 0) as debt_principal,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'finance_cost'), 0) as finance_cost
  from normalized group by report_month
), category_rows as (
  select coalesce(c.name, '미분류') as label, coalesce(t.effective_category_id::text, 'unassigned') as id, sum(t.signed_amount) as value
  from normalized t left join public.categories c on c.id = t.effective_category_id
  where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund')
  group by t.effective_category_id, c.name order by value desc
), payment_rows as (
  select coalesce(pm.name, '미지정') as label, coalesce(t.effective_payment_method_id::text, 'unassigned') as id, sum(t.signed_amount) as value
  from normalized t left join public.payment_methods pm on pm.id = t.effective_payment_method_id
  where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund')
  group by t.effective_payment_method_id, pm.name order by value desc
), recent_rows as (
  select id, transaction_date, transaction_type, flow_class, amount, description from normalized
  where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and status = 'posted'
  order by transaction_date desc, created_at desc limit 5
), budget_summary as (
  select coalesce((select sum(b.amount) from public.budgets b where b.household_id = p_household_id and (b.year * 12 + b.month) between (extract(year from p_month_start)::int * 12 + extract(month from p_month_start)::int) and (extract(year from p_month_end)::int * 12 + extract(month from p_month_end)::int) and b.transaction_type = 'expense'), 0) as total,
    coalesce((select sum(t.signed_amount) from normalized t where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund') and t.include_in_budget), 0) as actual
)
select jsonb_build_object(
  'monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb),
  'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.value desc) from category_rows c), '[]'::jsonb),
  'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.value desc) from payment_rows p), '[]'::jsonb),
  'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent_rows r), '[]'::jsonb),
  'reviewCount', (select count(*) from normalized where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and needs_review),
  'plannedCount', (select count(*) from normalized where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and status = 'planned'),
  'budgetTotal', (select total from budget_summary),
  'budgetActual', (select actual from budget_summary)
);
$$;

revoke all on function public.dashboard_home_summary(uuid, date, date, date, date) from public;
grant execute on function public.dashboard_home_summary(uuid, date, date, date, date) to authenticated;
