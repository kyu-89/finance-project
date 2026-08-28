-- PRD §5.4 requires deleted transactions to stay recoverable for 30 days, so hard delete must
-- never be reachable at all -- not even as a "safety net" a buggy or malicious direct SDK call
-- could hit while relying on app-layer discipline alone. Dropping this policy makes DELETE
-- denied by default under RLS for every caller, including the household's own owner, matching
-- the categories/subcategories/payment_methods precedent. Soft delete (UPDATE deleted_at) is the
-- only deletion path -- see src/lib/transactions.ts's softDeleteTransaction.
drop policy "transactions: owner delete" on public.transactions;
