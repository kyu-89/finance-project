-- 2026-09: 직전 마이그레이션(20260909140000)이 용돈지출의 display_order를 "그 가계 지출
-- 대분류 중 최댓값+1"로 계산했는데, 그 최댓값이 실제로는 실제 사용 중인 대분류가 아니라 시스템
-- 폴백 카테고리 "미분류"(display_order=99, 실제 연간 리포트 행이 아님)여서 100이 되어버렸다.
-- 의도한 값(이벤트지출=13 바로 다음)으로 바로잡는다.
update public.categories
set display_order = 14
where transaction_type = 'expense' and name = '용돈지출' and display_order = 100;
