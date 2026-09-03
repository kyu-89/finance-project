-- 2026-09: 사용자가 확인한 6쌍의 결혼식 축의금 지출 중복 제거.
-- 같은 날짜·같은 금액으로 두 번 기록된 거래들("규남/OOO결혼식" 계열과 "결혼식/OOO" 계열이
-- 같은 실제 지출을 서로 다른 표기로 두 번 남긴 것) — 각 쌍에서 결제수단이 채워진(더 완전한)
-- 쪽을 남기고, payment_method_id가 비어 있던 쪽을 소프트 삭제한다.
-- 사용자 승인: "2번 이동현이 같고 금액 같으면 동일건이니까 아무거나 하나 삭제해."
update public.transactions
set deleted_at = now()
where household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2'
  and deleted_at is null
  and id in (
    '0e87166d-4c60-473b-8bc1-84e91b003326', -- 규남/이동현결혼식 2024-11-01 100,000 (keep cc745dc1-…, has payment_method_id)
    '956ad1e1-d92a-4b41-8643-bd53ef751d13', -- 규남/유재민결혼식 2024-12-13 150,000 (keep 7c0895a8-…, has payment_method_id)
    '387c745d-ca54-4975-b848-1993196fae12', -- 규남/김미현결혼식 2025-04-25 200,000 (keep eaa60e1c-…, has payment_method_id)
    '839823c9-91cb-4328-9e7f-56c56991b954', -- 규남/주상진결혼식 2025-11-29 100,000 (keep 6c9ad6c8-…, has payment_method_id)
    '55142e6d-f1ec-48b5-8105-ebf7c5abbba6', -- 규남/김경민결혼식 2026-03-13 200,000 (keep 6473c504-…, has payment_method_id)
    'e61e940c-78e8-4825-95bc-7b78054c55cc'  -- 규남/신동현결혼식 2026-03-21 50,000 (keep 23c6c796-…, has payment_method_id)
  );
