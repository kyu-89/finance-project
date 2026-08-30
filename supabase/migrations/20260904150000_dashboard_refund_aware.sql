create or replace function public.dashboard_home_summary(
  p_household_id uuid,
  p_from date,
  p_to date,
  p_month_start date,
  p_month_end date,
  p_member_id uuid default null,
  p_unassigned boolean default false
) returns jsonb
language sql stable security invoker set search_path = public
as $$
with filtered as (
  select t.*,
    parent.category_id as parent_category_id,
    parent.payment_method_id as parent_payment_method_id,
    parent.cost_behavior as parent_cost_behavior
  from public.transactions t
  left join public.transactions parent on parent.id = t.parent_transaction_id
    and parent.household_id = t.household_id
    and parent.deleted_at is null
  where t.household_id = p_household_id
    and t.deleted_at is null
    and t.transaction_date between p_from and p_to
    and (
      (p_member_id is null and not p_unassigned)
      or (not p_unassigned and coalesce(t.beneficiary_member_id, t.payer_member_id) = p_member_id)
      or (p_unassigned and t.beneficiary_member_id is null and t.payer_member_id is null)
    )
), normalized as (
  select filtered.*,
    case when transaction_type = 'refund' then -amount else amount end as signed_amount,
    coalesce(category_id, parent_category_id) as effective_category_id,
    coalesce(payment_method_id, parent_payment_method_id) as effective_payment_method_id,
    coalesce(cost_behavior, parent_cost_behavior) as effective_cost_behavior
  from filtered
), monthly as (
  select to_char(date_trunc('month', transaction_date), 'YYYY-MM') as month,
    coalesce(sum(amount) filter (where status = 'posted' and transaction_type = 'income'), 0) as income,
    coalesce(sum(signed_amount) filter (where status = 'posted' and (flow_class = 'consumption' or transaction_type = 'refund')), 0) as consumption,
    coalesce(sum(signed_amount) filter (where status = 'posted' and (flow_class = 'consumption' or transaction_type = 'refund') and effective_cost_behavior = 'fixed'), 0) as fixed_consumption,
    coalesce(sum(signed_amount) filter (where status = 'posted' and (flow_class = 'consumption' or transaction_type = 'refund') and effective_cost_behavior = 'variable'), 0) as variable_consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'saving'), 0) as saving,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'investment'), 0) as investment,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'debt_principal'), 0) as debt_principal,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'finance_cost'), 0) as finance_cost
  from normalized group by 1
), category_rows as (
  select coalesce(c.name, '미분류') as label, coalesce(t.effective_category_id::text, 'unassigned') as id, sum(t.signed_amount) as value,
    coalesce((select jsonb_agg(jsonb_build_object('id', coalesce(s.subcategory_id::text, 'unassigned'), 'label', coalesce(sc.name, '미분류'), 'value', s.value) order by s.value desc)
      from (select t2.subcategory_id, sum(t2.signed_amount) as value from normalized t2 where t2.transaction_date between p_month_start and p_month_end and t2.status = 'posted' and (t2.flow_class = 'consumption' or t2.transaction_type = 'refund') and t2.effective_category_id is not distinct from t.effective_category_id group by t2.subcategory_id) s left join public.subcategories sc on sc.id = s.subcategory_id), '[]'::jsonb) as subcategories
  from normalized t left join public.categories c on c.id = t.effective_category_id
  where t.transaction_date between p_month_start and p_month_end and t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund')
  group by t.effective_category_id, c.name order by value desc
), payment_rows as (
  select coalesce(pm.name, '미지정') as label, coalesce(t.effective_payment_method_id::text, 'unassigned') as id, sum(t.signed_amount) as value
  from normalized t left join public.payment_methods pm on pm.id = t.effective_payment_method_id
  where t.transaction_date between p_month_start and p_month_end and t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund')
  group by t.effective_payment_method_id, pm.name order by value desc
), recent_rows as (
  select id, transaction_date, transaction_type, flow_class, amount, description from normalized
  where transaction_date between p_month_start and p_month_end and status = 'posted' order by transaction_date desc, created_at desc limit 5
), budget_summary as (
  select coalesce((select sum(b.amount) from public.budgets b where b.household_id = p_household_id and (b.year * 12 + b.month) between (extract(year from p_month_start)::int * 12 + extract(month from p_month_start)::int) and (extract(year from p_month_end)::int * 12 + extract(month from p_month_end)::int) and b.transaction_type = 'expense'), 0) as total,
    coalesce((select sum(t.signed_amount) from normalized t where t.transaction_date between p_month_start and p_month_end and t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund') and t.include_in_budget), 0) as actual
)
select jsonb_build_object('monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb), 'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.value desc) from category_rows c), '[]'::jsonb), 'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.value desc) from payment_rows p), '[]'::jsonb), 'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent_rows r), '[]'::jsonb), 'reviewCount', (select count(*) from normalized where transaction_date between p_month_start and p_month_end and needs_review), 'plannedCount', (select count(*) from normalized where transaction_date between p_month_start and p_month_end and status = 'planned'), 'budgetTotal', (select total from budget_summary), 'budgetActual', (select actual from budget_summary));
$$;

revoke all on function public.dashboard_home_summary(uuid,date,date,date,date,uuid,boolean) from public;
grant execute on function public.dashboard_home_summary(uuid,date,date,date,date,uuid,boolean) to authenticated;
