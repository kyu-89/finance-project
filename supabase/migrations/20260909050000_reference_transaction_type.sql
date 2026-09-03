-- 참고 거래(reference transaction) 유형 추가 (사용자 지시).
--
-- 수입·지출로 볼 수 없지만 기록은 보존해야 하는 거래(카드 대납, 현금 환급 등)를 위한 세 번째
-- transaction_type. flow_class를 cash_in/consumption과 완전히 분리된 'excluded' 값으로 둬서,
-- 기존 집계(dashboard_home_summary RPC 포함)가 전부 flow_class 등호 비교만 쓰기 때문에 이
-- 값 하나만 추가하면 총수입/총지출/월간합계/예산사용액/카테고리분석에서 코드 변경 없이
-- 자동으로 제외된다.
--
-- CHECK 제약 확장은 반드시 데이터 사용보다 먼저 와야 한다(폭을 좁히는 것과 반대 순서).

-- 0. transaction_type/flow_class CHECK 제약에 'reference'/'excluded' 추가.
alter table public.transactions drop constraint transactions_transaction_type_check;
alter table public.transactions add constraint transactions_transaction_type_check
  check (transaction_type = any (array['income', 'expense', 'reference']));

alter table public.transactions drop constraint transactions_flow_class_check;
alter table public.transactions add constraint transactions_flow_class_check
  check (flow_class = any (array['cash_in', 'consumption', 'excluded']));

-- 1. 기존 needs_review 백로그 중 실제 참고 거래로 확인된 316건만 전환한다(사용자 확인 — 나머지
-- 228건은 카테고리 매핑만 안 됐을 뿐인 정상 수입/지출이라 건드리지 않는다). 조건은 조사 때 쓴
-- 것과 동일: needs_review=true, 대/소분류 없음, transaction_type='expense', memo에 "원본 Excel에
-- 카테고리 값 없음" 표시(마이그레이션 당시 남긴 것) — 316건 정확히 일치 확인됨.
update public.transactions
set transaction_type = 'reference',
    flow_class = 'excluded',
    cost_behavior = null,
    include_in_budget = false,
    needs_review = false
where needs_review = true
  and deleted_at is null
  and category_id is null
  and subcategory_id is null
  and transaction_type = 'expense'
  and memo like '%카테고리 미지정%';
