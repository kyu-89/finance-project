-- Household sharing, step 1: household_users (access control) + is_household_user() helper.
--
-- household_users answers ONE question only: "who may access this household's data?" It is not
-- a family-member/ownership concept for financial data (households.owner_user_id remains the
-- sole household-management authority, and no table gains an owner_member_id/payer_member_id-
-- style column here or anywhere else in this project).
create table public.household_users (
  household_id uuid not null
    references public.households(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member'
    check (role in ('member')),

  created_at timestamptz not null default now(),

  primary key (household_id, user_id)
);

alter table public.household_users enable row level security;

-- Deliberately NOT is_household_user() here: that function queries this very table, and using
-- it in household_users' own policy would make every membership check recurse into itself. Both
-- policies instead go straight through households, which is not self-referential.
create policy "household_users: member or owner select" on public.household_users
  for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.households h
      where h.id = household_users.household_id
        and h.owner_user_id = (select auth.uid())
    )
  );

-- Household management (who gets added/removed) stays owner-only, per the project's existing
-- "household management is owner-restricted" boundary — a member cannot add or remove anyone,
-- including themselves.
create policy "household_users: owner insert" on public.household_users
  for insert
  with check (
    exists (
      select 1 from public.households h
      where h.id = household_users.household_id
        and h.owner_user_id = (select auth.uid())
    )
  );

create policy "household_users: owner update" on public.household_users
  for update
  using (
    exists (
      select 1 from public.households h
      where h.id = household_users.household_id
        and h.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.households h
      where h.id = household_users.household_id
        and h.owner_user_id = (select auth.uid())
    )
  );

create policy "household_users: owner delete" on public.household_users
  for delete
  using (
    exists (
      select 1 from public.households h
      where h.id = household_users.household_id
        and h.owner_user_id = (select auth.uid())
    )
  );

-- Shared membership check for every other table's RLS. SECURITY INVOKER (matching every
-- existing *_tenant_check function in this project) so it runs under the calling user's own
-- permissions/RLS rather than bypassing them — no DEFINER, no elevated-privilege recursion risk.
create function public.is_household_user(p_household_id uuid)
returns boolean
language sql
security invoker
stable
as $$
  select exists (
    select 1 from public.household_users hu
    where hu.household_id = p_household_id
      and hu.user_id = (select auth.uid())
  )
$$;

comment on table public.household_users is
  'Who may access a household''s data (not a financial-ownership concept). See households.owner_user_id for household management authority.';
comment on function public.is_household_user(uuid) is
  'True if the current auth.uid() is a member of the given household. Used by every business-table RLS policy in place of the old owner_user_id-only check.';
