-- households: one row per household (PRD §3.1 — even a single-person user gets a household)
create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '우리집',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- household_members: the shared analysis axis for every financial record (PRD §3.1)
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_type text not null check (member_type in ('self', 'spouse', 'child', 'other')),
  display_name text not null,
  linked_user_id uuid null references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_members_household_id_idx on public.household_members (household_id);
create unique index households_owner_user_id_idx on public.households (owner_user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- households policies: owner_user_id = auth.uid() (PRD §16.2)
create policy "households: owner select"
on public.households for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy "households: owner insert"
on public.households for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy "households: owner update"
on public.households for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "households: owner delete"
on public.households for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

-- household_members policies: gated through the parent household's owner_user_id
create policy "household_members: owner select"
on public.household_members for select
to authenticated
using (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);

create policy "household_members: owner insert"
on public.household_members for insert
to authenticated
with check (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);

create policy "household_members: owner update"
on public.household_members for update
to authenticated
using (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
)
with check (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);

create policy "household_members: owner delete"
on public.household_members for delete
to authenticated
using (
  household_id in (
    select id from public.households where owner_user_id = (select auth.uid())
  )
);
