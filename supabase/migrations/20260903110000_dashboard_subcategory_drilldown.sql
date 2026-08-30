-- Add category -> subcategory drill-down data to the dashboard summary.
create or replace function public.dashboard_home_summary(
  p_household_id uuid, p_from date, p_to date, p_month_start date, p_month_end date,
  p_member_id uuid default null, p_unassigned boolean default false
) returns jsonb
language sql stable security invoker set search_path = public
as $$
with filtered as (
  select t.* from public.transactions t where t.household_id = p_household_id and t.deleted_at is null
    and t.transaction_date between p_from and p_to
    and ((p_member_id is null and not p_unassigned) or (not p_unassigned and coalesce(t.beneficiary_member_id, t.payer_member_id) = p_member_id) or (p_unassigned and t.beneficiary_member_id is null and t.payer_member_id is null))
), monthly as (
  select to_char(date_trunc('month', transaction_date), 'YYYY-MM') as month,
    coalesce(sum(amount) filter (where status = 'posted' and transaction_type = 'income'), 0) as income,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'consumption'), 0) as consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'consumption' and cost_behavior = 'fixed'), 0) as fixed_consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'consumption' and cost_behavior = 'variable'), 0) as variable_consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'saving'), 0) as saving,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'investment'), 0) as investment,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'debt_principal'), 0) as debt_principal,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'finance_cost'), 0) as finance_cost
  from filtered group by 1
), category_rows as (
  select coalesce(c.name, '미분류') as label, coalesce(t.category_id::text, 'unassigned') as id, sum(t.amount) as value,
    coalesce((select jsonb_agg(jsonb_build_object('id', coalesce(s.subcategory_id::text, 'unassigned'), 'label', coalesce(sc.name, '미분류'), 'value', s.value) order by s.value desc) from (select t2.subcategory_id, sum(t2.amount) as value from filtered t2 where t2.transaction_date between p_month_start and p_month_end and t2.status = 'posted' and t2.flow_class = 'consumption' and t2.category_id is not distinct from t.category_id group by t2.subcategory_id) s left join public.subcategories sc on sc.id = s.subcategory_id), '[]'::jsonb) as subcategories
  from filtered t left join public.categories c on c.id = t.category_id
  where t.transaction_date between p_month_start and p_month_end and t.status = 'posted' and t.flow_class = 'consumption'
  group by t.category_id, c.name order by value desc
), payment_rows as (
  select coalesce(pm.name, '미지정') as label, coalesce(t.payment_method_id::text, 'unassigned') as id, sum(t.amount) as value from filtered t left join public.payment_methods pm on pm.id = t.payment_method_id
  where t.transaction_date between p_month_start and p_month_end and t.status = 'posted' and t.flow_class = 'consumption' group by t.payment_method_id, pm.name order by value desc
), recent_rows as (
  select id, transaction_date, transaction_type, flow_class, amount, description from filtered where transaction_date between p_month_start and p_month_end and status = 'posted' order by transaction_date desc, created_at desc limit 5
), budget_summary as (
  select coalesce(sum(b.amount) filter (where b.transaction_type = 'expense'), 0) as total, coalesce((select sum(t.amount) from filtered t where t.transaction_date between p_month_start and p_month_end and t.status = 'posted' and t.flow_class = 'consumption' and t.include_in_budget), 0) as actual from public.budgets b where b.household_id = p_household_id and b.year = extract(year from p_month_start)::int and b.month = extract(month from p_month_start)::int
)
select jsonb_build_object('monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb), 'categories', coalesce((select jsonb_agg(to_jsonb(c)) from category_rows c), '[]'::jsonb), 'payments', coalesce((select jsonb_agg(to_jsonb(p)) from payment_rows p), '[]'::jsonb), 'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent_rows r), '[]'::jsonb), 'reviewCount', (select count(*) from filtered where transaction_date between p_month_start and p_month_end and needs_review), 'plannedCount', (select count(*) from filtered where transaction_date between p_month_start and p_month_end and status = 'planned'), 'budgetTotal', (select total from budget_summary), 'budgetActual', (select actual from budget_summary));
$$;

revoke all on function public.dashboard_home_summary(uuid,date,date,date,date,uuid,boolean) from public;
grant execute on function public.dashboard_home_summary(uuid,date,date,date,date,uuid,boolean) to authenticated;
