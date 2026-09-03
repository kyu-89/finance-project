-- 20260909080000의 재시도. 그 마이그레이션은 대상 19건이 status='planned'라고 가정했는데,
-- 조사 시점과 마이그레이션 적용 시점 사이에 promotePastPlannedTransactions()(지난 예정 거래
-- 자동 확정 — transaction_date가 이번 달 이전인 planned 거래를 페이지 로드 시 posted로 바꿈)가
-- 실행돼 19건 전부 status='posted'로 이미 바뀌어 있었다. 그래서 원래 마이그레이션은 0건에
-- 매치되어 사실상 아무 것도 안 지웠다(실제 소프트 삭제 안 됨, 확인됨).
--
-- 이번엔 status 값에 의존하지 않고 안정적인 기준(transaction_support_details 연결 + 마이그레이션
-- 당시 남긴 고유 메모 패턴)으로 다시 찾아 지운다. 참고: status='posted'로 바뀌었다는 건 이
-- 19건(합계 50,138,000원)이 잠깐이라도 실제 총수입 집계에 포함됐었다는 뜻이라 더더욱 빨리
-- 정리해야 한다.
update public.transactions t
set deleted_at = now()
where t.household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
  and t.deleted_at is null
  and t.memo like '%날짜 추정됨%'
  and exists (select 1 from public.transaction_support_details tsd where tsd.transaction_id = t.id);

delete from public.transaction_support_details tsd
using public.transactions t
where tsd.transaction_id = t.id
  and t.household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
  and t.deleted_at is not null
  and t.memo like '%날짜 추정됨%';
