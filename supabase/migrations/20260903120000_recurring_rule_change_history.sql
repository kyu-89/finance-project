create table public.recurring_rule_change_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recurring_rule_id uuid not null references public.recurring_rules(id) on delete cascade,
  changed_at timestamptz not null default now(),
  old_amount bigint not null,
  new_amount bigint not null,
  old_status text not null,
  new_status text not null,
  old_start_date date not null,
  new_start_date date not null,
  old_end_date date null,
  new_end_date date null,
  old_frequency text not null,
  new_frequency text not null,
  old_interval_count integer not null,
  new_interval_count integer not null,
  old_day_of_month integer null,
  new_day_of_month integer null
);

create index recurring_rule_change_history_rule_idx
  on public.recurring_rule_change_history(recurring_rule_id, changed_at desc);

alter table public.recurring_rule_change_history enable row level security;
create policy "recurring_rule_change_history: owner"
on public.recurring_rule_change_history for select to authenticated
using (household_id in (select id from public.households where owner_user_id = (select auth.uid())));

create or replace function public.record_recurring_rule_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.default_amount is distinct from new.default_amount
    or old.status is distinct from new.status
    or old.start_date is distinct from new.start_date
    or old.end_date is distinct from new.end_date
    or old.frequency is distinct from new.frequency
    or old.interval_count is distinct from new.interval_count
    or old.day_of_month is distinct from new.day_of_month then
    insert into public.recurring_rule_change_history (
      household_id, recurring_rule_id, old_amount, new_amount, old_status, new_status,
      old_start_date, new_start_date, old_end_date, new_end_date, old_frequency,
      new_frequency, old_interval_count, new_interval_count, old_day_of_month, new_day_of_month
    ) values (
      new.household_id, new.id, old.default_amount, new.default_amount, old.status, new.status,
      old.start_date, new.start_date, old.end_date, new.end_date, old.frequency,
      new.frequency, old.interval_count, new.interval_count, old.day_of_month, new.day_of_month
    );
  end if;
  return new;
end;
$$;

create trigger recurring_rule_change_history_trigger
before update on public.recurring_rules
for each row execute function public.record_recurring_rule_change();
