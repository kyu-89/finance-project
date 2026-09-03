-- 대시보드에 참고 거래 요약(건수·카드 사용액)을 추가한다(사용자 지시 §8).
-- 참고 거래는 총수입/총지출/월간합계 등 기존 필드에서는 계속 자동 제외되고(flow_class='excluded'),
-- 이 두 필드에서만 별도로 보여준다. "카드 사용액"은 결제수단이 신용/체크카드인 참고 거래만 더한
-- 금액이다(현금·계좌이체는 카드 사용액이 아니므로 제외).
create or replace function public.dashboard_home_summary(p_household_id uuid, p_from date, p_to date, p_month_start date, p_month_end date)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
with filtered as (
  select t.*, coalesce(t.source_month, to_char(t.transaction_date, 'YYYY-MM')) as report_month
  from public.transactions t
  where t.household_id = p_household_id and t.deleted_at is null
    and coalesce(t.source_month, to_char(t.transaction_date, 'YYYY-MM')) between to_char(p_from, 'YYYY-MM') and to_char(p_to, 'YYYY-MM')
), monthly as (
  select report_month as month,
    coalesce(sum(amount) filter (where status = 'posted' and transaction_type = 'income'), 0) as income,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'consumption'), 0) as consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'consumption' and cost_behavior = 'fixed'), 0) as fixed_consumption,
    coalesce(sum(amount) filter (where status = 'posted' and flow_class = 'consumption' and cost_behavior = 'variable'), 0) as variable_consumption
  from filtered group by report_month
), category_rows as (
  select coalesce(c.name, '미분류') as label, coalesce(t.category_id::text, 'unassigned') as id, sum(t.amount) as value
  from filtered t left join public.categories c on c.id = t.category_id
  where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and t.flow_class = 'consumption'
  group by t.category_id, c.name order by value desc
), payment_rows as (
  select coalesce(pm.name, '미지정') as label, coalesce(t.payment_method_id::text, 'unassigned') as id, sum(t.amount) as value
  from filtered t left join public.payment_methods pm on pm.id = t.payment_method_id
  where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and t.flow_class = 'consumption'
  group by t.payment_method_id, pm.name order by value desc
), recent_rows as (
  select id, transaction_date, transaction_type, flow_class, amount, description from filtered
  where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and status = 'posted'
  order by transaction_date desc, created_at desc limit 5
), budget_summary as (
  select coalesce((select sum(b.amount) from public.budgets b where b.household_id = p_household_id and (b.year * 12 + b.month) between (extract(year from p_month_start)::int * 12 + extract(month from p_month_start)::int) and (extract(year from p_month_end)::int * 12 + extract(month from p_month_end)::int) and b.transaction_type = 'expense'), 0) as total,
    coalesce((select sum(t.amount) from filtered t where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and t.flow_class = 'consumption' and t.include_in_budget), 0) as actual
), reference_summary as (
  select count(*) as count,
    coalesce(sum(t.amount) filter (where pm.method_type in ('credit_card', 'check_card')), 0) as card_amount
  from filtered t left join public.payment_methods pm on pm.id = t.payment_method_id
  where t.report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and t.status = 'posted' and t.transaction_type = 'reference'
)
select jsonb_build_object(
  'monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb),
  'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.value desc) from category_rows c), '[]'::jsonb),
  'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.value desc) from payment_rows p), '[]'::jsonb),
  'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent_rows r), '[]'::jsonb),
  'reviewCount', (select count(*) from filtered where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and needs_review),
  'plannedCount', (select count(*) from filtered where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and status = 'planned'),
  'budgetTotal', (select total from budget_summary),
  'budgetActual', (select actual from budget_summary),
  'referenceCount', (select count from reference_summary),
  'referenceCardAmount', (select card_amount from reference_summary)
);
$function$;
