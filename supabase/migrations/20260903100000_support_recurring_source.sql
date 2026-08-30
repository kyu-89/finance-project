alter table public.recurring_rules drop constraint if exists recurring_rules_source_type_check;
alter table public.recurring_rules add constraint recurring_rules_source_type_check check (source_type in ('insurance', 'saving', 'loan', 'subscription', 'salary', 'support', 'manual'));
