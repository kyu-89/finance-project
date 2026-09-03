-- 2026-09: 대출/적금 상품이 반복거래 규칙을 자동 생성할 때, 이름으로 찾는 카테고리·소분류
-- (주거비>주담대 원금/이자, 저축성지출>예/적금)가 해당 가계에 없으면 지금까지는 에러 없이
-- category_id/subcategory_id를 NULL로 조용히 저장했다. 실 운영 가계는 카테고리가 이미 정상
-- 시딩되어 있어 지금까지 문제가 드러나지 않았지만(§14 조사에서 확인), 이 상태는 방어적으로
-- 막아야 한다 — 카테고리를 못 찾은 채 저장되면 그 반복거래는 지출 대분류 분석·카드별 사용액에
-- 안 잡히고, amountFor()의 원금/이자 구분도 조용히 깨질 수 있다(둘 다 subcategory_id를 이름으로
-- 찾은 뒤 비교하는 방식이라, 두 쪽 다 NULL이면 우연히 같아져 원금·이자가 뒤섞일 수 있음).
-- 함수 본문은 20260909030000의 것을 그대로 베이스로 삼고, 조회 실패 시 raise exception만 추가했다.

create or replace function public.create_loan_recurring_rules()
returns trigger
language plpgsql
as $function$
declare
  v_term_months integer;
  v_amortizing_months integer;
  v_monthly_rate numeric;
  v_first_interest bigint;
  v_principal_default bigint;
  v_equal_payment numeric;
  v_housing_category_id uuid;
  v_principal_subcategory_id uuid;
  v_interest_subcategory_id uuid;
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

  select id into v_housing_category_id from public.categories where household_id = new.household_id and name = '주거비';
  if v_housing_category_id is null then
    raise exception '가계(%)에 "주거비" 카테고리가 없어 대출 반복거래 규칙을 만들 수 없습니다.', new.household_id using errcode = 'check_violation';
  end if;
  select id into v_principal_subcategory_id from public.subcategories where category_id = v_housing_category_id and name = '주담대 원금';
  select id into v_interest_subcategory_id from public.subcategories where category_id = v_housing_category_id and name = '주담대 이자';
  if v_principal_subcategory_id is null then
    raise exception '가계(%)에 "주거비 > 주담대 원금" 소분류가 없어 대출 반복거래 규칙을 만들 수 없습니다.', new.household_id using errcode = 'check_violation';
  end if;

  insert into public.recurring_rules (household_id, source_type, source_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, category_id, subcategory_id, description, include_in_budget)
  values (new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1, extract(day from new.first_payment_date), v_principal_default, 'expense', 'consumption', 'fixed', v_housing_category_id, v_principal_subcategory_id, new.loan_name || ' 원금', false)
  on conflict (household_id, source_type, source_id, transaction_type, subcategory_id) where source_id is not null do nothing;
  if v_first_interest > 0 then
    if v_interest_subcategory_id is null then
      raise exception '가계(%)에 "주거비 > 주담대 이자" 소분류가 없어 대출 반복거래 규칙을 만들 수 없습니다.', new.household_id using errcode = 'check_violation';
    end if;
    insert into public.recurring_rules (household_id, source_type, source_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, category_id, subcategory_id, description, include_in_budget)
    values (new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1, extract(day from new.first_payment_date), v_first_interest, 'expense', 'consumption', 'fixed', v_housing_category_id, v_interest_subcategory_id, new.loan_name || ' 이자', true)
    on conflict (household_id, source_type, source_id, transaction_type, subcategory_id) where source_id is not null do nothing;
  end if;
  return new;
end;
$function$;

create or replace function public.create_savings_recurring_rule()
returns trigger
language plpgsql
as $function$
declare
  v_saving_category_id uuid;
  v_saving_subcategory_id uuid;
begin
  if new.status = 'active' and new.auto_recurring and new.monthly_payment_day is not null then
    select id into v_saving_category_id from public.categories where household_id = new.household_id and name = '저축성지출';
    if v_saving_category_id is null then
      raise exception '가계(%)에 "저축성지출" 카테고리가 없어 적금 반복거래 규칙을 만들 수 없습니다.', new.household_id using errcode = 'check_violation';
    end if;
    select id into v_saving_subcategory_id from public.subcategories where category_id = v_saving_category_id and name = '예/적금';
    if v_saving_subcategory_id is null then
      raise exception '가계(%)에 "저축성지출 > 예/적금" 소분류가 없어 적금 반복거래 규칙을 만들 수 없습니다.', new.household_id using errcode = 'check_violation';
    end if;
    insert into public.recurring_rules (
      household_id, source_type, source_id, start_date, end_date, frequency, interval_count,
      day_of_month, default_amount, transaction_type, flow_class, category_id, subcategory_id, description, include_in_budget
    ) values (
      new.household_id, 'saving', new.id, new.joined_at, new.maturity_date, 'monthly', 1,
      new.monthly_payment_day, new.monthly_amount, 'expense', 'consumption', v_saving_category_id, v_saving_subcategory_id, new.product_name || ' 적금 납입', true
    ) on conflict (household_id, source_type, source_id, transaction_type, subcategory_id)
      where source_id is not null do nothing;
  end if;
  return new;
end;
$function$;
