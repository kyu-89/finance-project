-- Preserve the workbook's owning sheet month separately from the real transaction date.
alter table public.transactions
  add column if not exists source_month text null
  check (source_month is null or source_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create index if not exists transactions_household_source_month_idx
  on public.transactions (household_id, source_month);
