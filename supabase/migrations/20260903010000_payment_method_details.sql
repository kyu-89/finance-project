alter table public.payment_methods
  add column if not exists provider_name text null,
  add column if not exists account_number text null,
  add column if not exists card_number_last4 text null,
  add column if not exists expires_at date null,
  add column if not exists owner_member_id uuid null references public.household_members (id) on delete set null;

create index if not exists payment_methods_owner_member_idx on public.payment_methods (owner_member_id);
