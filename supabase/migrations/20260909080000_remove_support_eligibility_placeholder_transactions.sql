-- 2026년 엑셀 '정부지원금' 탭에서 가져온 데이터를 전부 삭제한다(사용자 지시).
--
-- 이 탭은 "받은 금액"이 아니라 "받을 수 있는 금액"(자격 요건)을 정리해 둔 시트였는데, 과거
-- SupportEventImport/importSupportEventsAction이 각 행을 실제 income 거래로 만들었다. 실제로
-- 받은 금액은 월마다 수입 > 기타수입으로 이미 따로 등록돼 있어(사용자 확인), 이 19건은 중복이자
-- 오데이터다.
--
-- 식별 기준(정확히 일치, 19건 확인): transaction_support_details에 연결되어 있고 status='planned'인
-- 거래. 전부 transaction_date가 2026-01-01(추정값)이고 memo가 "[날짜 추정됨, 원문 신청기간: ...]"
-- 패턴이라 다른 정상 거래와 섞일 위험이 없음을 조사로 확인했다(합계 50,138,000원, 연결된
-- recurring_rules 없음).
--
-- 거래는 소프트 삭제(deleted_at만 채움 — 30일 이내 설정 > 데이터 관리에서 복구 가능)를 먼저
-- 적용하고, 그다음 연결된 transaction_support_details를 실제로 삭제한다(deleted_at 컬럼이 없는
-- 순수 상세 메타데이터라 소프트 삭제 대상이 아님) — 순서가 반대면 두 번째 단계의 조인 기준이
-- 사라지므로 반드시 이 순서로 실행한다.
update public.transactions t
set deleted_at = now()
where t.household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
  and t.deleted_at is null
  and t.status = 'planned'
  and exists (select 1 from public.transaction_support_details tsd where tsd.transaction_id = t.id);

delete from public.transaction_support_details tsd
using public.transactions t
where tsd.transaction_id = t.id
  and t.household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
  and t.deleted_at is not null
  and t.status = 'planned';
