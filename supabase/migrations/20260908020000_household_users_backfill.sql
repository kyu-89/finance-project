-- Household sharing, step 2: backfill household_users.
--
-- Part A (general, every household): every existing household's owner becomes a member of their
-- own household. Idempotent and safe to re-run — this is the baseline every household needs
-- regardless of sharing.
insert into public.household_users (household_id, user_id, role)
select h.id, h.owner_user_id, 'member'
from public.households h
on conflict (household_id, user_id) do nothing;

-- Part B (this specific request): connect the wife's account to the husband's household.
--
-- Verified before writing this migration (read-only queries against production, 2026-09-03):
--   - Husband kk897777@gmail.com owns household 558ae2c6-79b3-43db-9809-ee55d5dd24f2, which has
--     the real data: 1304 transactions, 42 accounts, 22 payment methods, 17 categories, 2 loans,
--     2 assets.
--   - Wife eoqkr1514@naver.com (note: naver.com, not the anver.com typo'd in chat) owns household
--     8e412a3b-bee0-499d-b2f1-7d9125c30371, which is Case A from the design doc: empty except the
--     default-seeded categories/payment methods every new household gets. Zero transactions,
--     accounts, assets, loans — nothing to lose by not merging it.
--
-- Per Case A's resolution, the wife is added to the husband's household rather than attempting
-- to merge her empty one. Her own household (8e412a3b...) is intentionally left untouched here —
-- not deleted, not merged — since it still exists and this project's standing rule is to never
-- auto-delete/merge household data without a separate, explicit approval.
insert into public.household_users (household_id, user_id, role)
values ('558ae2c6-79b3-43db-9809-ee55d5dd24f2', '1e9419bc-2475-4407-8615-db0f878c5973', 'member')
on conflict (household_id, user_id) do nothing;
