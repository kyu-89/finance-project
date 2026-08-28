-- 20260831070000 documented the `ended` status as terminal and unreachable by "direct SDK/RPC
-- callers", but implemented the guard only inside update_recurring_rule_status. The UPDATE policy
-- permits any column change on an owned row, so a plain PostgREST PATCH could revive an ended
-- rule and restart occurrence generation. Move the guarantee into the table, where the comment
-- always claimed it was.
create or replace function public.recurring_rules_ended_is_terminal()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'ended' and new.status is distinct from 'ended' then
    raise exception '종료된 반복규칙은 다시 활성화할 수 없습니다'
      using errcode = 'check_violation';
  end if;

  -- An ended rule's schedule and base amount are historical record: freezing them keeps past
  -- posted transactions interpretable against the rule that produced them (§5.5.4).
  if old.status = 'ended' and (
    new.default_amount is distinct from old.default_amount
    or new.frequency is distinct from old.frequency
    or new.interval_count is distinct from old.interval_count
    or new.day_of_month is distinct from old.day_of_month
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
  ) then
    raise exception '종료된 반복규칙의 일정·금액은 변경할 수 없습니다'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger recurring_rules_ended_is_terminal_trigger
  before update on public.recurring_rules
  for each row execute function public.recurring_rules_ended_is_terminal();
