-- A recurring occurrence is an immutable identity. Even if its transaction is soft-deleted,
-- materialization must not create a replacement and silently double-count the same installment.
drop index public.transactions_one_live_row_per_occurrence;
create unique index transactions_one_row_per_occurrence
  on public.transactions (recurring_occurrence_id);
