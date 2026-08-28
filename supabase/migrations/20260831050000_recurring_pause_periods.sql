create table public.recurring_rule_pauses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recurring_rule_id uuid not null references public.recurring_rules (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_rule_id, start_date, end_date)
);

create index recurring_rule_pauses_rule_dates_idx
  on public.recurring_rule_pauses (recurring_rule_id, start_date, end_date);

alter table public.recurring_rule_pauses enable row level security;
create policy "recurring_rule_pauses: owner select" on public.recurring_rule_pauses for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));
create policy "recurring_rule_pauses: owner insert" on public.recurring_rule_pauses for insert to authenticated
with check (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create trigger recurring_rule_pauses_set_updated_at before update on public.recurring_rule_pauses
for each row execute function public.set_updated_at();

create or replace function public.recurring_rule_pause_tenant_check()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.recurring_rules r
    where r.id = new.recurring_rule_id and r.household_id = new.household_id
  ) then raise exception 'recurring_rule_pauses.recurring_rule_id belongs to a different household'
    using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger recurring_rule_pause_tenant_check_trigger
before insert or update on public.recurring_rule_pauses
for each row execute function public.recurring_rule_pause_tenant_check();

create or replace function public.add_recurring_pause_period(
  p_rule_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if p_end_date < p_start_date then
    raise exception 'pause end date must not precede start date' using errcode = 'check_violation';
  end if;

  select household_id into v_household_id
  from public.recurring_rules
  where id = p_rule_id and status <> 'ended';
  if v_household_id is null then
    raise exception 'pausable recurring rule not found' using errcode = 'check_violation';
  end if;

  insert into public.recurring_rule_pauses (
    household_id, recurring_rule_id, start_date, end_date, reason
  ) values (
    v_household_id, p_rule_id, p_start_date, p_end_date, nullif(trim(p_reason), '')
  ) on conflict (recurring_rule_id, start_date, end_date) do nothing;

  update public.transactions
  set status = 'skipped'
  where recurring_rule_id = p_rule_id
    and transaction_date between p_start_date and p_end_date
    and status = 'planned'
    and deleted_at is null;
end;
$$;

revoke all on function public.add_recurring_pause_period(uuid, date, date, text) from public;
grant execute on function public.add_recurring_pause_period(uuid, date, date, text) to authenticated;

-- Pause periods are audit/lifecycle records and intentionally have no UPDATE/DELETE policy.
