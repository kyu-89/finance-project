alter table public.transactions
  add column if not exists tags text[] not null default '{}';

create index if not exists transactions_tags_gin_idx on public.transactions using gin (tags);
