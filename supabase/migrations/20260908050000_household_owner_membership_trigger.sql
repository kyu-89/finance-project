-- Household sharing, step 5: auto-register the owner as a household_user on creation.
--
-- Found via the existing RLS integration test suite (tests/integration/rls-*.test.ts), which
-- inserts households directly with owner_user_id, bypassing src/lib/household.ts entirely: any
-- household created without also getting a household_users row locks its own owner out under
-- the new is_household_user()-based policies — including the owner themselves, immediately,
-- before they could ever add anyone else. household.ts's ensureHouseholdForCurrentUser was fixed
-- to insert the membership row itself, but that only covers app code; a trigger makes the
-- invariant "the owner is always a member of their own household" hold for every insert path
-- (tests, future admin tooling, anything) without relying on each one remembering to do it.
--
-- SECURITY INVOKER, matching every other function in this project: no elevated privileges are
-- needed because the row inserted here always satisfies household_users' own owner-check INSERT
-- policy — the just-inserted households row (visible to this AFTER trigger within the same
-- transaction) has owner_user_id = the inserting user, which is exactly what that policy checks.
create function public.household_owner_membership_trigger()
returns trigger
language plpgsql
security invoker
as $$
begin
  insert into public.household_users (household_id, user_id, role)
  values (new.id, new.owner_user_id, 'member')
  on conflict (household_id, user_id) do nothing;
  return new;
end;
$$;

create trigger household_owner_membership
after insert on public.households
for each row
execute function public.household_owner_membership_trigger();

comment on function public.household_owner_membership_trigger() is
  'Keeps "the owner is a household_users member of their own household" true for every insert path, not just src/lib/household.ts.';
