-- 2026-09: 2024-02-23에 임포트된 축의금 수입 129건(이름만 있는 description, 수입>기타수입으로
-- 이미 올바르게 분류됨)이 needs_review=true로 남아 설정>검토 필요 목록에 계속 떠 있었다.
-- 원인: 임포트 당시 원본 엑셀의 소분류 텍스트가 기존 수입 소분류(급여/수당/상여/투자수익/이자/
-- 부수익/처분소득/기타수입/이월) 중 어느 것과도 매칭되지 않아 기타수입으로 폴백하며 검토
-- 플래그가 붙었다. 사용자 확인: 카테고리는 지금 상태(수입>기타수입) 그대로 두고 검토 플래그만
-- 해제한다 — "그 상태 그대로 마이그레이션 하라고".
update public.transactions
set needs_review = false
where household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
  and deleted_at is null
  and transaction_date = '2024-02-23'
  and category_id = '4379031a-b19c-43ae-b627-b316d4117bdd'
  and needs_review = true;
