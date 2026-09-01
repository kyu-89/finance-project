create table if not exists public.import_sync_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_type text not null check (source_type in ('workbook_monthly', 'transactions')),
  source_file_name text not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  created_at timestamptz not null default now()
);
create index if not exists import_sync_runs_household_created_idx on public.import_sync_runs(household_id, created_at desc);
alter table public.import_sync_runs enable row level security;
create policy "import_sync_runs: owner select" on public.import_sync_runs for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "import_sync_runs: owner insert" on public.import_sync_runs for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
