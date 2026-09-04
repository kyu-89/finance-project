-- 2026-09(사용자 지시): income_group(고정수입/추가수입)과 대칭인 expense_group(저축성지출/
-- 소비성지출)을 추가한다. income_group과 달리 이 값은 사용자가 직접 고르지 않는다 — 저축성
-- 지출인지 아닌지는 category_id 하나로 이미 100% 결정되는 값이라(대분류=저축성지출이면
-- savings, 아니면 consumption), 별도 입력을 받으면 "카테고리는 식비인데 구분은 저축성지출"
-- 같은 모순 저장이 가능해진다. 그래서 트리거로 매 insert/update마다 자동으로 맞춘다 — 수동
-- 입력·엑셀 임포트·거래 수정 어느 경로로 들어와도 항상 category_id와 일관된다.
alter table public.transactions
  add column expense_group text null check (expense_group in ('savings', 'consumption'));

create or replace function public.set_transaction_expense_group()
returns trigger
language plpgsql
as $function$
declare
  v_savings_category_id uuid;
begin
  if new.transaction_type = 'expense' then
    select id into v_savings_category_id from public.categories
      where household_id = new.household_id and name = '저축성지출';
    new.expense_group := case
      when v_savings_category_id is not null and new.category_id = v_savings_category_id then 'savings'
      else 'consumption'
    end;
  else
    new.expense_group := null;
  end if;
  return new;
end;
$function$;

create trigger transactions_set_expense_group
  before insert or update on public.transactions
  for each row execute function public.set_transaction_expense_group();

-- 이미 있는 지출 거래에도 한 번 소급 적용한다(트리거는 이 시점 이후의 insert/update에만 붙음).
update public.transactions t
set expense_group = case
  when exists (
    select 1 from public.categories c
    where c.id = t.category_id and c.household_id = t.household_id and c.name = '저축성지출'
  ) then 'savings'
  else 'consumption'
end
where t.transaction_type = 'expense';
