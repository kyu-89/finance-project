-- 조회 전용 인덱스: 거래 화면의 공통 조건(household_id + 삭제 제외)을
-- 기간/원본월/검토 상태별로 빠르게 찾도록 한다.
create index if not exists transactions_household_source_month_active_idx
  on public.transactions (household_id, source_month)
  where deleted_at is null;

create index if not exists transactions_household_needs_review_active_idx
  on public.transactions (household_id, needs_review)
  where deleted_at is null and needs_review = true;

create index if not exists recurring_occurrences_household_rule_date_idx
  on public.recurring_occurrences (household_id, recurring_rule_id, occurrence_date);
