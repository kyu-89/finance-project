create or replace function public.dashboard_payment_summary(
  p_household_id uuid, p_from date, p_to date, p_member_id uuid default null, p_unassigned boolean default false
) returns jsonb
language sql stable security invoker set search_path = public
as $$
with filtered as (
  select t.*, parent.payment_method_id as parent_payment_method_id
  from public.transactions t
  left join public.transactions parent on parent.id = t.parent_transaction_id
    and parent.household_id = t.household_id and parent.deleted_at is null
  where t.household_id = p_household_id and t.deleted_at is null
    and t.transaction_date between p_from and p_to
    and ((p_member_id is null and not p_unassigned)
      or (not p_unassigned and coalesce(t.beneficiary_member_id, t.payer_member_id) = p_member_id)
      or (p_unassigned and t.beneficiary_member_id is null and t.payer_member_id is null))
), rows_by_month as (
  select to_char(date_trunc('month', t.transaction_date), 'YYYY-MM') as month,
    coalesce(t.payment_method_id, t.parent_payment_method_id) as payment_method_id,
    coalesce(pm.name, '미지정') as label,
    sum(case when t.transaction_type = 'refund' then -t.amount else t.amount end) as value
  from filtered t left join public.payment_methods pm on pm.id = coalesce(t.payment_method_id, t.parent_payment_method_id)
  where t.status = 'posted' and (t.flow_class = 'consumption' or t.transaction_type = 'refund')
  group by 1, 2, pm.name
), monthly as (
  select month, sum(value) as total,
    jsonb_agg(jsonb_build_object('id', coalesce(payment_method_id::text, 'unassigned'), 'label', label, 'value', value) order by value desc) as payments
  from rows_by_month group by month
)
select coalesce(jsonb_agg(jsonb_build_object('month', month, 'total', total, 'categories', payments) order by month), '[]'::jsonb)
from monthly;
$$;

revoke all on function public.dashboard_payment_summary(uuid,date,date,uuid,boolean) from public;
grant execute on function public.dashboard_payment_summary(uuid,date,date,uuid,boolean) to authenticated;
