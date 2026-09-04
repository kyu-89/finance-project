-- 2026-09(사용자 지시): "용돈지출은 지출 대분류에 용돈지출 소분류에 남편용돈으로 처리해" —
-- "남편 용돈"이 두 군데(문화생활비 소분류 / 용돈지출 소분류)에 중복 생성돼 있었다. 확인 결과
-- 실거래 대부분(34건, 9,794,413원)은 이미 용돈지출→남편 용돈에 정상적으로 쌓여 있었고,
-- 문화생활비→남편 용돈 쪽엔 예전에 잘못 등록된 1건(300,000원)만 남아 있었다. 용돈지출은
-- 원래(2023년 원본 엑셀) 독립된 지출 대분류였는데 DEFAULT_EXPENSE_CATEGORIES 시드 목록에는
-- 없었고, "남편 용돈"이 문화생활비 소분류로도 잘못 들어가 있던 상태 — 이번에 용돈지출 쪽을
-- 정본으로 확정한다.

-- 1) 문화생활비→남편 용돈에 남아있는 거래를 용돈지출→남편 용돈으로 옮긴다.
update public.transactions t
set category_id = correct.expense_category_id,
    subcategory_id = correct.correct_subcategory_id
from (
  select
    wrong_sub.id as wrong_subcategory_id,
    correct_cat.id as expense_category_id,
    correct_sub.id as correct_subcategory_id
  from public.subcategories wrong_sub
  join public.categories wrong_cat on wrong_cat.id = wrong_sub.category_id and wrong_cat.name = '문화생활비'
  join public.categories correct_cat on correct_cat.household_id = wrong_cat.household_id and correct_cat.name = '용돈지출'
  join public.subcategories correct_sub on correct_sub.category_id = correct_cat.id and correct_sub.name = '남편 용돈'
  where wrong_sub.name = '남편 용돈'
) as correct
where t.subcategory_id = correct.wrong_subcategory_id;

-- 2) 옮긴 뒤, 문화생활비→남편 용돈 소분류는 앞으로 선택되지 않도록 비활성화한다(삭제가 아니라
--    is_active=false — 과거 이력의 참조 무결성을 그대로 보존한다).
update public.subcategories wrong_sub
set is_active = false
from public.categories wrong_cat
where wrong_cat.id = wrong_sub.category_id
  and wrong_cat.name = '문화생활비'
  and wrong_sub.name = '남편 용돈';

-- 3) 용돈지출 대분류의 display_order를 그 가계의 지출 대분류 중 가장 마지막 순번 다음으로
--    맞춘다(엑셀에 없던 임시값 99 대신, 다른 대분류들과 같은 규칙으로 정렬되게 — 연간 리포트가
--    display_order 순서를 그대로 행 순서로 쓴다).
update public.categories target
set display_order = ranked.next_order
from (
  select c.id, (
    select coalesce(max(c2.display_order), -1) + 1
    from public.categories c2
    where c2.household_id = c.household_id and c2.transaction_type = 'expense' and c2.name <> '용돈지출'
  ) as next_order
  from public.categories c
  where c.name = '용돈지출' and c.transaction_type = 'expense'
) as ranked
where target.id = ranked.id;

-- 4) 용돈지출→남편 용돈 소분류의 display_order도 0으로 맞춘다(그 대분류의 유일한 소분류).
update public.subcategories target
set display_order = 0
from public.categories cat
where cat.id = target.category_id and cat.name = '용돈지출' and target.name = '남편 용돈';
