-- Household sharing, step 3: created_by_user_id on user-authored business tables.
--
-- This is NOT a data-ownership field (see docs/Supabase 가계부 가족 공유 기능 구조 개선 작업.md
-- §5) — it only records who created a row. Every household member can still read/update/delete
-- any row in their household regardless of who created it; that stays entirely governed by
-- household_users via is_household_user(household_id), unaffected by this column.
--
-- DEFAULT auth.uid() means the application never supplies this value itself — there is
-- no code path where a client could pass an arbitrary user_id (§7's requirement). Existing rows
-- get NULL (no retroactive attribution invented); every new insert from here on is stamped
-- automatically by Postgres at insert time, under RLS, using the inserting user's own auth.uid().
-- ON DELETE SET NULL: if a user's auth account is ever removed, their past entries are kept, just
-- without attribution — never cascaded away.
--
-- Scope: the 15 tables the design doc named as "반드시 검토" (all confirmed as genuine
-- user-authored primary data, not derived/log data), plus 4 more found during STEP 1 analysis
-- that fit the identical description but weren't named in the doc: loan_payments (real
-- repayment-history entries, has its own create action), investment_transactions (buy/sell
-- trade records), transaction_event_details and transaction_support_details (경조사/지원금
-- detail forms, each with their own save action independent of the parent transaction).
--
-- Explicitly excluded (system/log/derived data, matching the doc's own examples and confirmed by
-- reading how each is populated): export_audit_logs, import_sync_runs, asset_value_history,
-- monthly_asset_snapshots, recurring_occurrences, recurring_rule_change_history. Also excluded:
-- event_records, support_programs — grep found zero application code referencing either table,
-- so they appear unused; adding a column to a table nothing writes to would be speculative.
alter table public.transactions add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.accounts add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.cards add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.assets add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.budgets add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.categories add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.subcategories add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.payment_methods add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.recurring_rules add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.savings_accounts add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.deposits add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.loans add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.insurances add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.financial_goals add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.financial_tasks add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();

alter table public.loan_payments add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.investment_transactions add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.transaction_event_details add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.transaction_support_details add column created_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
