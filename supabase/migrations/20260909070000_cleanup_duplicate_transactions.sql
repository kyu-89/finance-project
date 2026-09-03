-- 설정 > 데이터 관리 > 중복 거래 검토 화면의 중복 후보를 일괄 정리한다(사용자 지시: "유지할
-- 원본만 남기고 나머지 전부 삭제해줘").
--
-- 이 화면(DuplicateTransactionReview)이 이미 쓰는 것과 완전히 같은 로직이다:
--   - 중복 판정 키: household_id, transaction_date, transaction_type, amount,
--     lower(trim(description)), payment_method_id (lib/duplicate-transactions.ts의
--     duplicateTransactionKey와 동일)
--   - 같은 키를 가진 행 중 created_at이 가장 이른 행이 "유지할 원본"(keeper)
--   - 나머지는 소프트 삭제(deleted_at만 채움, 실제 DELETE 아님 — 30일 이내 설정 > 데이터 관리에서
--     복구 가능, softDeleteTransaction/restoreTransaction과 동일한 정책)
--
-- 사전 조사: 실제 가구(558ae2c6-79b3-43db-9809-ee55d5dd24f2)에서 39개 그룹, 52건의 중복 후보를
-- 확인했다. 표본 조사 결과 각 그룹의 행들이 created_at까지 밀리초 단위로 동일해(같은 엑셀 마이그
-- 레이션 INSERT 배치에서 중복 삽입된 것으로 보임) 실제 중복이 맞음을 확인했다. 다른 가구(테스트
-- 데이터)는 이번 정리 대상이 아니라 건드리지 않는다.
with keyed as (
  select id,
    row_number() over (
      partition by household_id, transaction_date, transaction_type, amount,
        lower(trim(description)), coalesce(payment_method_id::text, '')
      order by created_at asc, id asc
    ) as rn
  from public.transactions
  where deleted_at is null and household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
)
update public.transactions
set deleted_at = now()
where id in (select id from keyed where rn > 1);
