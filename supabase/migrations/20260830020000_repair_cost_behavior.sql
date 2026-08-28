-- One-time repair. PRD §35 says a category's default_cost_behavior change must NOT
-- retroactively alter past transactions' snapshotted cost_behavior -- that rule protects
-- deliberate user decisions. It does not apply here: these rows never reflected a user
-- decision, they reflect a seed bug (Sprint 1 stamped every expense category except
-- 저축성지출 as 'variable', contradicting PRD §4.1's own worked examples for
-- 월세/정액 관리비/보험료/통신 기본요금). Repairing them once is the whole point.
--
-- Scope is deliberately narrow: only the three category NAMES the seed got wrong, only
-- rows still holding the incorrect 'variable' value, and only transactions whose
-- cost_behavior still matches the (wrong) category default -- a user who has since
-- overridden a transaction individually is left alone.
--
-- !! DO NOT RE-RUN THIS FILE MANUALLY AFTER Sprint 1.5 Tasks 5 and 7 SHIP. !!
-- It is safe to re-run ONLY in the world it was written for: one where no category-editing UI
-- and no per-transaction cost_behavior override exist, so every 'variable' row under these
-- three categories is provably a snapshot of the buggy seed default rather than a user's
-- decision. Once those UIs exist, statement 2's guard can no longer tell the two apart and
-- would silently clobber a deliberate override; statement 1 would likewise overwrite a
-- deliberate category-level change. `supabase db push` applies each migration once and will
-- never re-run this on its own -- the hazard is only a manual replay (SQL editor, DR restore,
-- a script that reapplies files outside Supabase's tracked-migration bookkeeping).

-- Side effect worth knowing: migration 20260830010000 installed set_updated_at triggers just
-- before this one runs, so every row repaired below gets its updated_at bumped to the repair's
-- execution time, indistinguishable from a real user edit. Nothing reads updated_at today, so
-- this is inert -- but a future "last edited" indicator, sync cursor, or optimistic-concurrency
-- check would misread every repaired row as freshly touched.

-- 1. Repair the category defaults themselves.
update public.categories
set default_cost_behavior = 'fixed'
where transaction_type = 'expense'
  and name in ('주거비', '보험비', '통신비')
  and default_cost_behavior is distinct from 'fixed';

-- 2. Repair transactions that inherited the wrong default.
--    Only expense rows, only ones currently 'variable', only ones whose category is now
--    'fixed' -- i.e. exactly the rows that would have been 'fixed' had the seed been right.
update public.transactions t
set cost_behavior = 'fixed'
from public.categories c
where t.category_id = c.id
  and t.transaction_type = 'expense'
  and t.cost_behavior = 'variable'
  and c.default_cost_behavior = 'fixed'
  and c.name in ('주거비', '보험비', '통신비');
