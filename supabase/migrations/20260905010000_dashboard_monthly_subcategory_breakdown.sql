create or replace function public.dashboard_monthly_subcategory_summary(
  p_household_id uuid, p_from date, p_to date, p_member_id uuid default null, p_unassigned boolean default false
) returns jsonb language sql stable security invoker set search_path = public as $$
with filtered as (
  select t.*, parent.category_id as parent_category_id
  from public.transactions t
  left join public.transactions parent on parent.id = t.parent_transaction_id and parent.household_id = t.household_id and parent.deleted_at is null
  where t.household_id = p_household_id and t.deleted_at is null and t.transaction_date between p_from and p_to
    and ((p_member_id is null and not p_unassigned) or (not p_unassigned and coalesce(t.beneficiary_member_id, t.payer_member_id) = p_member_id) or (p_unassigned and t.beneficiary_member_id is null and t.payer_member_id is null))
), normalized as (
  select filtered.*, coalesce(category_id, parent_category_id) as effective_category_id,
    case when transaction_type = 'refund' then -amount else amount end as signed_amount
  from filtered
), category_totals as (
  select to_char(date_trunc('month', t.transaction_date), 'YYYY-MM') as month, t.effective_category_id,
    coalesce(c.name, '미분류') as label, sum(t.signed_amount) as value
  from normalized t left join public.categories c on c.id = t.effective_category_id
  where t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund')
  group by 1, 2, c.name
), category_with_children as (
  select ct.month, ct.effective_category_id, ct.label, ct.value,
    coalesce((select jsonb_agg(jsonb_build_object('id', coalesce(s.subcategory_id::text, 'unassigned'), 'label', coalesce(sc.name, '미분류'), 'value', s.value) order by s.value desc)
      from (select n.subcategory_id, sum(n.signed_amount) as value from normalized n where n.status = 'posted' and (n.flow_class = 'consumption' or n.transaction_type = 'refund') and to_char(date_trunc('month', n.transaction_date), 'YYYY-MM') = ct.month and n.effective_category_id is not distinct from ct.effective_category_id group by n.subcategory_id) s left join public.subcategories sc on sc.id = s.subcategory_id), '[]'::jsonb) as subcategories
  from category_totals ct
)
select coalesce(jsonb_agg(jsonb_build_object('month', month, 'id', coalesce(effective_category_id::text, 'unassigned'), 'label', label, 'value', value, 'subcategories', subcategories) order by month, value desc), '[]'::jsonb) from category_with_children;
$$;

revoke all on function public.dashboard_monthly_subcategory_summary(uuid,date,date,uuid,boolean) from public;
grant execute on function public.dashboard_monthly_subcategory_summary(uuid,date,date,uuid,boolean) to authenticated;
