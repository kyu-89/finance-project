-- 거래 유형을 수입/지출 두 가지로만 축소한다 (2026-09, 사용자 승인).
--
-- 배경: docs 세션 합의 — [거래 유형] 드롭다운에서 환불/저축/투자/대출원금상환/금융비용/이체를 없애고
-- 수입/지출만 남긴다. 환불(취소)은 별도 transaction_type이 아니라 기존 거래 자체의 status를
-- 'cancelled'/'refunded'로 바꾸는 방식으로 대체한다(취소선 표시 + 지출 합계에서 자동 제외 —
-- status='posted' 필터가 이미 모든 집계에 있으므로 추가 로직 없이 동작).
--
-- 사전 조사(.superpowers/type-refactor/inventory.md, 읽기 전용 서브에이전트 분석)로 확인한 실제
-- 영향 범위: 실거래 데이터는 income/expense/refund(39건)/debt_principal(2건)/finance_cost(2건)뿐이고
-- saving/investment/transfer/asset_adjustment는 0건(별도 savings_accounts/investment_transactions
-- 테이블로 추적되므로 transactions에는 애초에 안 들어감) — 삭제해도 실거래 손실 없음.
--
-- 순서: 1) 데이터 이관(기존 행 UPDATE) → 2) 트리거/함수 재정의 → 3) RPC 재정의 → 4) CHECK 제약 축소.
-- 데이터 이관을 제약 축소보다 먼저 해야 축소된 제약에 걸리지 않는다.

-- =========================================================================================
-- 0. status CHECK 제약을 먼저 넓힌다 — 'refunded'는 아래 1c에서 바로 쓰는데, type 축소와 달리
-- 이건 "허용값 확대"라 데이터보다 나중이 아니라 먼저 해야 한다(반대로 type 축소는 "허용값 축소"라
-- 데이터 이관 뒤에 해야 기존 값이 안 걸린다 — 5번 참고).
-- =========================================================================================
alter table public.transactions drop constraint transactions_status_check;
alter table public.transactions add constraint transactions_status_check check (status in ('planned', 'posted', 'skipped', 'cancelled', 'refunded'));

-- =========================================================================================
-- 0.5. 남아있는 테스트 household 정리 — type 축소 제약을 걸기 전, 실사용 가구 외에도 'saving' 등
-- 남은 타입이 있는지 전체 household를 확인한 결과, 전부 tests/integration/product-recurring.test.ts
-- 실행이 남긴 일회성 테스트 계정이었다(household.name='상품 반복 테스트', owner 이메일이
-- product-recurring-<timestamp>-...@example.com 패턴 — 3중으로 확인). 실사용자 데이터가 아니라
-- 테스트가 정리하지 않고 남긴 부산물이라 삭제한다(household 삭제 시 transactions/recurring_rules는
-- ON DELETE CASCADE로 함께 지워짐, 별도 확인 완료). id를 정확히 하드코딩해 다른 household는
-- 절대 건드리지 않는다.
-- =========================================================================================
delete from public.households where id in (
  '042012ec-277a-4585-b9c2-5868c76e5075',
  '1d0940a5-d689-404d-8b93-626c1d8ce979',
  '78f34c88-2bf9-4d3e-8057-9ccf0b5e2e25',
  '90f090b8-a6dc-4a76-acf3-139259eba9c0',
  'bfa6d828-db5d-4456-b261-b4d5eaef5169',
  'ef76c8eb-d1f0-4140-b8d1-1bc554e37bc8'
);

-- =========================================================================================
-- 1. 데이터 이관 (household 558ae2c6-79b3-43db-9809-ee55d5dd24f2 — 실사용 가구)
-- =========================================================================================

-- 1a. 대출원금(debt_principal) → 지출 > 주거비 > 주담대 원금 (사용자 명시적 지시)
update public.transactions
set transaction_type = 'expense',
    flow_class = 'consumption',
    cost_behavior = coalesce(cost_behavior, 'fixed'),
    category_id = (select id from public.categories where household_id = transactions.household_id and name = '주거비'),
    subcategory_id = (select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.household_id = transactions.household_id and c.name = '주거비' and s.name = '주담대 원금')
where transaction_type = 'debt_principal';

-- 1b. 금융비용(finance_cost) → 지출 > 주거비 > 주담대 이자 (사용자 명시적 지시)
update public.transactions
set transaction_type = 'expense',
    flow_class = 'consumption',
    cost_behavior = coalesce(cost_behavior, 'fixed'),
    category_id = (select id from public.categories where household_id = transactions.household_id and name = '주거비'),
    subcategory_id = (select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.household_id = transactions.household_id and c.name = '주거비' and s.name = '주담대 이자')
where transaction_type = 'finance_cost';

-- 1c. 환불(refund, 39건) → 지출 유형 유지 + status='refunded' (카테고리/금액/날짜는 그대로 — 엑셀에서
-- 넘어온 이력이라 parent_transaction_id가 전부 NULL이라 "원거래를 취소 처리"할 대상이 없다. 이
-- 39건 자체를 "환불 처리된 지출"로 표시해 지금처럼 지출 합계에서 빠지는 효과를 새 방식으로 유지한다).
update public.transactions
set transaction_type = 'expense',
    flow_class = 'consumption',
    status = 'refunded'
where transaction_type = 'refund';

-- =========================================================================================
-- 1.5. recurring_rules의 유니크 인덱스 교체 — 반드시 아래 2번(데이터 이관)보다 먼저 실행해야 한다.
--
-- recurring_rules_one_product_flow UNIQUE(household_id, source_type, source_id, transaction_type)
-- WHERE source_id IS NOT NULL — 원래 "같은 대출의 원금 규칙과 이자 규칙"을 transaction_type
-- ('debt_principal' vs 'finance_cost')으로 구분해 유니크를 보장했다. 이제 둘 다 transaction_type=
-- 'expense'가 되면 이 인덱스 키가 완전히 같아져서 2번 UPDATE의 두 번째 문장이 유니크 위반으로
-- 실패한다(원금 행을 먼저 expense로 바꾼 순간, 이자 행이 그것과 (household_id, loan, source_id,
-- expense)로 충돌) — 그리고 앞으로 새 대출이 생길 때도 원금/이자 중 하나만 만들어지는 실제 기능
-- 손실로 이어진다. subcategory_id를 키에 추가해(원금↔이자를 이제 이 컬럼이 구분) 같은 "상품당 항목당
-- 1행" 불변식을 유지한다.
-- =========================================================================================
drop index if exists public.recurring_rules_one_product_flow;
create unique index recurring_rules_one_product_flow on public.recurring_rules
  (household_id, source_type, source_id, transaction_type, subcategory_id)
  where source_id is not null;

-- =========================================================================================
-- 2. recurring_rules 이관 — 대출 원금/이자 자동생성 규칙 2개 (household 558ae2c6...)
-- =========================================================================================
update public.recurring_rules
set transaction_type = 'expense',
    flow_class = 'consumption',
    cost_behavior = 'fixed',
    category_id = (select id from public.categories where household_id = recurring_rules.household_id and name = '주거비'),
    subcategory_id = (select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.household_id = recurring_rules.household_id and c.name = '주거비' and s.name = '주담대 원금')
where source_type = 'loan' and transaction_type = 'debt_principal';

update public.recurring_rules
set transaction_type = 'expense',
    flow_class = 'consumption',
    cost_behavior = 'fixed',
    category_id = (select id from public.categories where household_id = recurring_rules.household_id and name = '주거비'),
    subcategory_id = (select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.household_id = recurring_rules.household_id and c.name = '주거비' and s.name = '주담대 이자')
where source_type = 'loan' and transaction_type = 'finance_cost';

-- =========================================================================================
-- 3. 트리거 함수 재정의 — 앞으로 새 대출/적금이 생겨도 income/expense만 쓰도록
-- =========================================================================================

-- 3a. create_loan_recurring_rules(): 대출 등록 시 원금/이자 반복거래 규칙을 자동 생성하던 트리거.
-- 실제 라이브 함수 본문을 pg_proc에서 직접 조회해 그대로 베이스로 삼았다(상환방법별 원금 계산식,
-- on conflict 안전장치, include_in_budget 등 처음 작성 때 놓쳤던 세부사항이 실제로는 이미 있었음).
-- 바뀌는 부분만: transaction_type/flow_class를 debt_principal/finance_cost → expense/consumption
-- 으로, 신설된 category_id/subcategory_id를 주거비 > 주담대 원금·이자로(위 1a/1b와 동일 매핑을
-- "앞으로 생기는 대출"에도 적용), cost_behavior를 원금 쪽에도 'fixed'로(기존엔 이자에만 있었음 —
-- 이제 둘 다 주거비 카테고리라 일관되게 고정비로 표시하는 것이 위 1a의 데이터 이관과 맞다).
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
  if v_housing_category_id is not null then
    select id into v_principal_subcategory_id from public.subcategories where category_id = v_housing_category_id and name = '주담대 원금';
    select id into v_interest_subcategory_id from public.subcategories where category_id = v_housing_category_id and name = '주담대 이자';
  end if;

  insert into public.recurring_rules (household_id, source_type, source_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, category_id, subcategory_id, description, include_in_budget)
  values (new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1, extract(day from new.first_payment_date), v_principal_default, 'expense', 'consumption', 'fixed', v_housing_category_id, v_principal_subcategory_id, new.loan_name || ' 원금', false)
  on conflict (household_id, source_type, source_id, transaction_type, subcategory_id) where source_id is not null do nothing;
  if v_first_interest > 0 then
    insert into public.recurring_rules (household_id, source_type, source_id, start_date, end_date, frequency, interval_count, day_of_month, default_amount, transaction_type, flow_class, cost_behavior, category_id, subcategory_id, description, include_in_budget)
    values (new.household_id, 'loan', new.id, new.first_payment_date, new.maturity_date, 'monthly', 1, extract(day from new.first_payment_date), v_first_interest, 'expense', 'consumption', 'fixed', v_housing_category_id, v_interest_subcategory_id, new.loan_name || ' 이자', true)
    on conflict (household_id, source_type, source_id, transaction_type, subcategory_id) where source_id is not null do nothing;
  end if;
  return new;
end;
$function$;

-- 3b. create_savings_recurring_rule(): 적금 등록 시 월 납입 반복거래 규칙을 자동 생성하던 트리거.
-- 마찬가지로 실제 라이브 본문(활성+자동납입+납입일 지정 조건, on conflict 안전장치, include_in_budget)을
-- 베이스로 삼았다. 기존에는 transaction_type='saving'으로 만들었다 — expense + 저축성지출 > 예/적금
-- 으로 만든다(대출 건과 동일 논리를 적금에도 적용한 것 — 사용자의 명시 지시는 없었으나 "카테고리가
-- 이미 구분해준다" 원칙과 같은 맥락이라 이렇게 매핑함, 최종 보고에서 별도로 알림).
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
    if v_saving_category_id is not null then
      select id into v_saving_subcategory_id from public.subcategories where category_id = v_saving_category_id and name = '예/적금';
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

-- 3c. sync_posted_savings_contribution(): recurring_rules.source_type='saving'만으로 "이 확정된
-- 거래가 적금 납입인지"를 판단하도록 수정(예전에는 and transaction_type='saving'도 같이 걸었는데,
-- 이제 transaction_type이 항상 'expense'라 이 조건이 있으면 절대 매칭이 안 돼 적금 잔액 동기화가
-- 조용히 멈춘다 — source_type 하나만으로 이미 충분히 특정된다). 나머지(greatest(0,...) 클램프,
-- status='active' 조건)는 실제 라이브 본문 그대로 유지.
create or replace function public.sync_posted_savings_contribution()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_savings_id uuid;
  v_old_contribution bigint := 0;
  v_new_contribution bigint := 0;
begin
  if new.recurring_rule_id is null then return new; end if;
  select source_id into v_savings_id from public.recurring_rules
  where id = new.recurring_rule_id and source_type = 'saving';
  if v_savings_id is null then return new; end if;

  if old.status = 'posted' and old.deleted_at is null then v_old_contribution := old.amount; end if;
  if new.status = 'posted' and new.deleted_at is null then v_new_contribution := new.amount; end if;
  if v_old_contribution <> v_new_contribution then
    update public.savings_accounts
    set current_savings = greatest(0, current_savings + v_new_contribution - v_old_contribution)
    where id = v_savings_id and household_id = new.household_id and status = 'active';
  end if;
  return new;
end;
$function$;

-- 3d. validate_refund_amount(): parent_transaction_id 기반 환불 흐름 전용 가드였다 — 그 흐름 자체를
-- 없애므로(§2의 앱 코드 변경과 짝) 이 함수와 트리거를 제거한다. status='refunded'로 표시하는 새 방식은
-- 같은 행의 status만 바꾸는 것이라 "환불 합계가 원거래 금액을 넘는지" 같은 별도 불변식이 필요 없다.
drop trigger if exists transactions_refund_amount_guard on public.transactions;
drop function if exists public.validate_refund_amount();

-- =========================================================================================
-- 4. RPC 재정의 — dashboard_home_summary만 (실제 라이브 DB를 pg_proc으로 직접 확인한 결과
-- dashboard_payment_summary/dashboard_monthly_subcategory_summary는 지금 DB에 존재하지 않는다 —
-- inventory.md가 언급한 두 마이그레이션 파일은 이후 20260907000000_remove_member_attribution.sql에서
-- dashboard_home_summary 하나로 통합되며 함께 drop된 것으로 보인다. 없는 함수를 재정의하는 대신,
-- 실제 라이브 함수인 dashboard_home_summary만 손댄다.
--
-- refund 전용 signed_amount 음수화 로직과 parent_transaction_id 조인이 전부 필요 없어진다(환불/취소
-- 거래는 이제 status<>'posted'라 기존 status='posted' 필터에 자동으로 걸러진다). saving/investment/
-- debt_principal/finance_cost 컬럼도 어차피 실거래가 전혀 없었으므로(대출은 이제 consumption으로
-- 이관) 제거한다 — 프론트(dashboard-home.ts/dashboard/page.tsx/DashboardMonthlyDetail.tsx)도 같은
-- 커밋에서 이 필드들을 더 이상 읽지 않도록 맞춘다.
-- =========================================================================================

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
)
select jsonb_build_object(
  'monthly', coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from monthly m), '[]'::jsonb),
  'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.value desc) from category_rows c), '[]'::jsonb),
  'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.value desc) from payment_rows p), '[]'::jsonb),
  'recent', coalesce((select jsonb_agg(to_jsonb(r)) from recent_rows r), '[]'::jsonb),
  'reviewCount', (select count(*) from filtered where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and needs_review),
  'plannedCount', (select count(*) from filtered where report_month between to_char(p_month_start, 'YYYY-MM') and to_char(p_month_end, 'YYYY-MM') and status = 'planned'),
  'budgetTotal', (select total from budget_summary),
  'budgetActual', (select actual from budget_summary)
);
$function$;

-- =========================================================================================
-- 5. CHECK 제약 축소
-- =========================================================================================

alter table public.transactions drop constraint transactions_transaction_type_check;
alter table public.transactions add constraint transactions_transaction_type_check check (transaction_type in ('income', 'expense'));

alter table public.transactions drop constraint transactions_flow_class_check;
alter table public.transactions add constraint transactions_flow_class_check check (flow_class in ('cash_in', 'consumption'));

-- transactions_status_check는 0번에서 이미 넓혀졌다(여기서 다시 손댈 필요 없음).

alter table public.recurring_rules drop constraint recurring_rules_transaction_type_check;
alter table public.recurring_rules add constraint recurring_rules_transaction_type_check check (transaction_type in ('income', 'expense'));

alter table public.recurring_rules drop constraint recurring_rules_flow_class_check;
alter table public.recurring_rules add constraint recurring_rules_flow_class_check check (flow_class in ('cash_in', 'consumption'));

alter table public.recurring_rules drop constraint recurring_rules_check1;
alter table public.recurring_rules add constraint recurring_rules_check1 check (
  (transaction_type = 'income' and flow_class = 'cash_in') or (transaction_type = 'expense' and flow_class = 'consumption')
);

alter table public.recurring_rules drop constraint recurring_rules_check2;
alter table public.recurring_rules add constraint recurring_rules_check2 check (cost_behavior is null or transaction_type = 'expense');
