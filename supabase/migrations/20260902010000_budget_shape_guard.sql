-- Sprint 3 remodelled income/saving budgets mid-sprint: commit 67e2817 keyed them to real
-- category ids, commit b58ca08 changed them to household-wide total targets (category_id is
-- null) but shipped no data migration. Rows in the old shape would still sum into 계획 수입 and
-- 저축 목표 (budget-calculations.ts filters only on transaction_type), inflating four tiles on
-- the 결산 screen -- and the user could never see or repair them, because the editor renders
-- only category_id-null rows for those types and `budgets` has no DELETE policy.
--
-- Verified against production before writing this: `budgets` holds 0 rows, so no orphaned data
-- exists and no repair statement is needed. This migration is purely preventive -- it makes the
-- broken shape unrepresentable so the same remodelling cannot silently recur.
--
-- If this ever runs against an environment that DID accumulate old-shape rows, the ALTER will
-- fail rather than corrupt anything; consolidate them into the matching category_id-null row
-- (sum, then delete via a privileged migration) before re-running.
alter table public.budgets
  add constraint budgets_income_saving_are_total_targets
  check (transaction_type = 'expense' or category_id is null);
