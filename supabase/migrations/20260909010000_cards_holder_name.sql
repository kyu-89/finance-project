-- Excel migration, schema step: preserve 명의자 (named cardholder) as a plain data attribute.
--
-- Per docs/Excel 가계부 전체 마이그레이션 작업.md §3 ("명의자") and the household-sharing doc's
-- repeated principle: 명의자 is a display/data attribute only, NEVER an access-control or
-- ownership field. A prior migration (20260907000000_remove_member_attribution.sql) deliberately
-- dropped cards.owner_member_id (an FK to household_members used for per-person filtering/
-- ownership) as part of removing all family-member attribution from financial tables. This
-- column is intentionally different in kind: plain nullable text, no FK, never referenced by RLS
-- or any ownership/access check — it exists only so a card's real-world named holder (e.g. "정미",
-- "엄마") can be shown, matching what the source Excel actually records.
alter table public.cards add column holder_name text null;

comment on column public.cards.holder_name is
  '명의자 (named cardholder) — a plain display attribute only. Never used for access control, ownership, or RLS; that is governed entirely by household_users via is_household_user(household_id), independent of this column.';
