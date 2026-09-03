-- Hotfix: the 2026-09 Excel migration deleted+recreated `loans` (old loan id
-- 85a23f0c-38c3-429d-92be-0cd29c51f79e replaced by a new row), but left 2 pre-existing
-- recurring_rules (원금/이자 for "아낌e-보금자리론") pointing at the now-deleted loan id.
-- Every /dashboard and /monthly load tries to materialize these rules' upcoming
-- occurrences; amountFor() can't find the (deleted) loan's payment schedule, computes an
-- amount of 0, and the insert into transactions then fails
-- transactions_amount_check ("amount > 0"), crashing both pages with an uncaught 500.
--
-- Verified before writing this migration (see session transcript, 2026-09-03):
--   - Zero real `transactions` rows reference either stale rule (recurring_rule_id SET NULL
--     on delete anyway, so even if there were any, no transaction data would be lost).
--   - The new loan (created by the migration's own createLoan() call) already has its own
--     correct pair of active recurring_rules — deleting these stale ones does not remove
--     the 원금/이자 auto-generation feature, it only removes the broken duplicate pointing
--     at data that no longer exists.
--   - A plain UPDATE (e.g. auto_generate = false) was tried first and rejected by this
--     table's own recurring_rule_source_tenant_check() trigger, which validates source_id
--     on every UPDATE, not just when source_id itself changes — so DELETE is the only path.
--   - recurring_occurrences/recurring_rule_pauses/recurring_rule_change_history all CASCADE
--     on recurring_rules deletion, cleanly removing the 24 orphaned occurrence rows these 2
--     rules had already materialized (also for the deleted loan, also not real transactions).
--
-- User-approved before running (destructive DML on production, docs/Excel 가계부 전체
-- 마이그레이션 작업.md §7 gate).
delete from public.recurring_rules
where id in ('df8d2d29-f337-4b53-8a5b-c181d6c3f278', '3ac1925e-379f-414b-aaaf-920fa3e17b8a')
  and household_id = '558ae2c6-79b3-43db-9809-ee55d5dd24f2';
