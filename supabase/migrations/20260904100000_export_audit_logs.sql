create table public.export_audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  export_type text not null check (export_type in ('transactions_csv', 'all_json')),
  request_path text not null,
  created_at timestamptz not null default now()
);

create index export_audit_logs_household_created_idx on public.export_audit_logs (household_id, created_at desc);
alter table public.export_audit_logs enable row level security;
create policy "export_audit_logs: owner select" on public.export_audit_logs for select to authenticated using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "export_audit_logs: owner insert" on public.export_audit_logs for insert to authenticated with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())) and user_id = (select auth.uid()));
