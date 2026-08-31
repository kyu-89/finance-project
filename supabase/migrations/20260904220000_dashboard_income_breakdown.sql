create or replace function public.dashboard_income_summary(
  p_household_id uuid, p_from date, p_to date, p_month_start date, p_month_end date,
  p_member_id uuid default null, p_unassigned boolean default false
) returns jsonb
language sql stable security invoker set search_path = public
as $$
with filtered as (
  select t.*, parent.category_id as parent_category_id
  from public.transactions t
  left join public.transactions parent on parent.id = t.parent_transaction_id
    and parent.household_id = t.household_id and parent.deleted_at is null
  where t.household_id = p_household_id and t.deleted_at is null
    and t.transaction_date between p_from and p_to and t.transaction_type = 'income'
    and ((p_member_id is null and not p_unassigned)
      or (not p_unassigned and coalesce(t.beneficiary_member_id, t.payer_member_id) = p_member_id)
      or (p_unassigned and t.beneficiary_member_id is null and t.payer_member_id is null))
), monthly_category_totals as (
  select to_char(date_trunc('month', t.transaction_date), 'YYYY-MM') as month,
    t.category_id, coalesce(c.name, '미분류') as label, sum(t.amount) as value
  from filtered t left join public.categories c on c.id = t.category_id
  where t.status = 'posted' group by 1, t.category_id, c.name
), monthly_categories as (
  select month, sum(value) as total,
    jsonb_agg(jsonb_build_object('id', coalesce(category_id::text, 'unassigned'), 'label', label, 'value', value) order by value desc) as categories
  from monthly_category_totals group by month
), current_rows as (
  select coalesce(c.name, '미분류') as label, coalesce(t.category_id::text, 'unassigned') as id, sum(t.amount) as value,
    coalesce((select jsonb_agg(jsonb_build_object('id', coalesce(s.subcategory_id::text, 'unassigned'), 'label', coalesce(sc.name, '미분류'), 'value', s.value) order by s.value desc)
      from (select t2.subcategory_id, sum(t2.amount) as value from filtered t2 where t2.status = 'posted' and t2.transaction_date between p_month_start and p_month_end and t2.category_id is not distinct from t.category_id group by t2.subcategory_id) s left join public.subcategories sc on sc.id = s.subcategory_id), '[]'::jsonb) as subcategories
  from filtered t left join public.categories c on c.id = t.category_id
  where t.status = 'posted' and t.transaction_date between p_month_start and p_month_end
  group by t.category_id, c.name order by value desc
)
select jsonb_build_object(
  'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'total', total, 'categories', categories) order by month) from monthly_categories), '[]'::jsonb),
  'current', coalesce((select jsonb_agg(to_jsonb(c) order by c.value desc) from current_rows c), '[]'::jsonb)
);
$$;

revoke all on function public.dashboard_income_summary(uuid,date,date,date,date,uuid,boolean) from public;
grant execute on function public.dashboard_income_summary(uuid,date,date,date,date,uuid,boolean) to authenticated;
