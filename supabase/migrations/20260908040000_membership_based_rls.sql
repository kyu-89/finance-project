-- Household sharing, step 4: switch every business-table RLS policy from
-- households.owner_user_id = auth.uid() to is_household_user(household_id) (or, for
-- subcategories, is_household_user() on its parent category's household_id — subcategories has
-- no household_id column of its own).
--
-- Every DROP POLICY below targets an existing policy by its exact current name and immediately
-- recreates it with the same name/command, only the condition changes — nothing is removed
-- without being replaced in the same statement block. Verified beforehand with a live
-- pg_policies dump so every policy name and expression here matches production exactly.
--
-- households itself keeps owner-only INSERT/UPDATE/DELETE (household management stays
-- owner-restricted per the design doc §10) — only its SELECT policy widens, so a member can see
-- the household they belong to (name, etc.), not just its owner.
drop policy if exists "households: owner select" on public.households;
create policy "households: owner select" on public.households
  for select
  using (
    owner_user_id = (select auth.uid())
    or is_household_user(id)
  );

drop policy if exists "accounts: owner insert" on public.accounts;
create policy "accounts: owner insert" on public.accounts
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "accounts: owner select" on public.accounts;
create policy "accounts: owner select" on public.accounts
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "accounts: owner update" on public.accounts;
create policy "accounts: owner update" on public.accounts
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "asset_value_history: owner" on public.asset_value_history;
create policy "asset_value_history: owner" on public.asset_value_history
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "assets: owner insert" on public.assets;
create policy "assets: owner insert" on public.assets
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "assets: owner select" on public.assets;
create policy "assets: owner select" on public.assets
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "assets: owner update" on public.assets;
create policy "assets: owner update" on public.assets
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "budgets: owner insert" on public.budgets;
create policy "budgets: owner insert" on public.budgets
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "budgets: owner select" on public.budgets;
create policy "budgets: owner select" on public.budgets
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "budgets: owner update" on public.budgets;
create policy "budgets: owner update" on public.budgets
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "cards: owner insert" on public.cards;
create policy "cards: owner insert" on public.cards
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "cards: owner select" on public.cards;
create policy "cards: owner select" on public.cards
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "cards: owner update" on public.cards;
create policy "cards: owner update" on public.cards
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "categories: owner insert" on public.categories;
create policy "categories: owner insert" on public.categories
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "categories: owner select" on public.categories;
create policy "categories: owner select" on public.categories
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "categories: owner update" on public.categories;
create policy "categories: owner update" on public.categories
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "deposits: owner insert" on public.deposits;
create policy "deposits: owner insert" on public.deposits
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "deposits: owner select" on public.deposits;
create policy "deposits: owner select" on public.deposits
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "deposits: owner update" on public.deposits;
create policy "deposits: owner update" on public.deposits
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "event_records: owner" on public.event_records;
create policy "event_records: owner" on public.event_records
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "export_audit_logs: owner insert" on public.export_audit_logs;
create policy "export_audit_logs: owner insert" on public.export_audit_logs
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "export_audit_logs: owner select" on public.export_audit_logs;
create policy "export_audit_logs: owner select" on public.export_audit_logs
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "financial_goals: owner" on public.financial_goals;
create policy "financial_goals: owner" on public.financial_goals
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "financial_tasks: owner" on public.financial_tasks;
create policy "financial_tasks: owner" on public.financial_tasks
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "import_sync_runs: owner insert" on public.import_sync_runs;
create policy "import_sync_runs: owner insert" on public.import_sync_runs
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "import_sync_runs: owner select" on public.import_sync_runs;
create policy "import_sync_runs: owner select" on public.import_sync_runs
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "insurances: owner insert" on public.insurances;
create policy "insurances: owner insert" on public.insurances
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "insurances: owner select" on public.insurances;
create policy "insurances: owner select" on public.insurances
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "insurances: owner update" on public.insurances;
create policy "insurances: owner update" on public.insurances
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "investment_transactions: owner" on public.investment_transactions;
create policy "investment_transactions: owner" on public.investment_transactions
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "loan_payments: owner insert" on public.loan_payments;
create policy "loan_payments: owner insert" on public.loan_payments
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "loan_payments: owner select" on public.loan_payments;
create policy "loan_payments: owner select" on public.loan_payments
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "loan_payments: owner update" on public.loan_payments;
create policy "loan_payments: owner update" on public.loan_payments
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "loans: owner insert" on public.loans;
create policy "loans: owner insert" on public.loans
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "loans: owner select" on public.loans;
create policy "loans: owner select" on public.loans
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "loans: owner update" on public.loans;
create policy "loans: owner update" on public.loans
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "snapshots: owner insert" on public.monthly_asset_snapshots;
create policy "snapshots: owner insert" on public.monthly_asset_snapshots
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "snapshots: owner select" on public.monthly_asset_snapshots;
create policy "snapshots: owner select" on public.monthly_asset_snapshots
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "snapshots: owner update" on public.monthly_asset_snapshots;
create policy "snapshots: owner update" on public.monthly_asset_snapshots
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "payment_methods: owner insert" on public.payment_methods;
create policy "payment_methods: owner insert" on public.payment_methods
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "payment_methods: owner select" on public.payment_methods;
create policy "payment_methods: owner select" on public.payment_methods
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "payment_methods: owner update" on public.payment_methods;
create policy "payment_methods: owner update" on public.payment_methods
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "recurring_occurrences: owner insert" on public.recurring_occurrences;
create policy "recurring_occurrences: owner insert" on public.recurring_occurrences
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "recurring_occurrences: owner select" on public.recurring_occurrences;
create policy "recurring_occurrences: owner select" on public.recurring_occurrences
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "recurring_occurrences: owner update" on public.recurring_occurrences;
create policy "recurring_occurrences: owner update" on public.recurring_occurrences
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "recurring_rule_change_history: owner insert" on public.recurring_rule_change_history;
create policy "recurring_rule_change_history: owner insert" on public.recurring_rule_change_history
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "recurring_rule_change_history: owner" on public.recurring_rule_change_history;
create policy "recurring_rule_change_history: owner" on public.recurring_rule_change_history
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "recurring_rule_pauses: owner insert" on public.recurring_rule_pauses;
create policy "recurring_rule_pauses: owner insert" on public.recurring_rule_pauses
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "recurring_rule_pauses: owner select" on public.recurring_rule_pauses;
create policy "recurring_rule_pauses: owner select" on public.recurring_rule_pauses
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "recurring_rules: owner insert" on public.recurring_rules;
create policy "recurring_rules: owner insert" on public.recurring_rules
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "recurring_rules: owner select" on public.recurring_rules;
create policy "recurring_rules: owner select" on public.recurring_rules
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "recurring_rules: owner update" on public.recurring_rules;
create policy "recurring_rules: owner update" on public.recurring_rules
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "savings_accounts: owner insert" on public.savings_accounts;
create policy "savings_accounts: owner insert" on public.savings_accounts
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "savings_accounts: owner select" on public.savings_accounts;
create policy "savings_accounts: owner select" on public.savings_accounts
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "savings_accounts: owner update" on public.savings_accounts;
create policy "savings_accounts: owner update" on public.savings_accounts
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "subcategories: owner insert" on public.subcategories;
create policy "subcategories: owner insert" on public.subcategories
  for INSERT
  with check (is_household_user((select category_id_household.household_id from public.categories category_id_household where category_id_household.id = subcategories.category_id)));

drop policy if exists "subcategories: owner select" on public.subcategories;
create policy "subcategories: owner select" on public.subcategories
  for SELECT
  using (is_household_user((select category_id_household.household_id from public.categories category_id_household where category_id_household.id = subcategories.category_id)));

drop policy if exists "subcategories: owner update" on public.subcategories;
create policy "subcategories: owner update" on public.subcategories
  for UPDATE
  using (is_household_user((select category_id_household.household_id from public.categories category_id_household where category_id_household.id = subcategories.category_id)))
  with check (is_household_user((select category_id_household.household_id from public.categories category_id_household where category_id_household.id = subcategories.category_id)));

drop policy if exists "support_programs: owner" on public.support_programs;
create policy "support_programs: owner" on public.support_programs
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "transaction_event_details: owner" on public.transaction_event_details;
create policy "transaction_event_details: owner" on public.transaction_event_details
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "transaction_support_details: owner" on public.transaction_support_details;
create policy "transaction_support_details: owner" on public.transaction_support_details
  for ALL
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

drop policy if exists "transactions: owner insert" on public.transactions;
create policy "transactions: owner insert" on public.transactions
  for INSERT
  with check (is_household_user(household_id));

drop policy if exists "transactions: owner select" on public.transactions;
create policy "transactions: owner select" on public.transactions
  for SELECT
  using (is_household_user(household_id));

drop policy if exists "transactions: owner update" on public.transactions;
create policy "transactions: owner update" on public.transactions
  for UPDATE
  using (is_household_user(household_id))
  with check (is_household_user(household_id));

