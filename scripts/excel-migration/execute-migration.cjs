'use strict';
/**
 * Excel -> DB migration: EXECUTION script.
 *
 * SAFETY: this script defaults to DRY RUN. Without `--execute` it performs ONLY read-only
 * (SELECT / count) queries against the DB to compute and print what it WOULD delete/insert —
 * zero INSERT/UPDATE/DELETE calls happen. Pass `--execute` to actually perform the migration.
 *
 * Input: scripts/excel-migration/dry-run-output.json (see scripts/excel-migration/dry-run.cjs).
 *
 * Run (safe, read-only):   node scripts/excel-migration/execute-migration.cjs
 * Run (writes to the DB):  node scripts/excel-migration/execute-migration.cjs --execute
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { config: loadEnv } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..', '..');

// Same precedence as tests/setup-env.ts: service-role key lives in .env.test.local (gitignored,
// never committed), the public project URL lives in .env.local.
loadEnv({ path: path.join(ROOT, '.env.test.local') });
loadEnv({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('필수 환경변수가 없습니다.');
  if (!SUPABASE_URL) console.error('  - NEXT_PUBLIC_SUPABASE_URL 이 .env.local 에 없습니다.');
  if (!SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY 가 .env.test.local 에 없습니다 (Supabase Dashboard -> Settings -> API -> service_role secret).');
  console.error('두 값 모두 이 저장소에 이미 존재하는 파일(.env.local, .env.test.local)에서 찾았어야 합니다 — 없다면 Supabase 프로젝트 대시보드에서 직접 가져와 해당 파일에 채워주세요. 이 스크립트가 임의로 값을 만들어내지 않습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const EXECUTE = process.argv.includes('--execute');
const HOUSEHOLD_ID = '558ae2c6-79b3-43db-9809-ee55d5dd24f2';
const CREATED_BY_EMAIL = 'eoqkr1514@naver.com';

const DRY_RUN_OUTPUT_PATH = path.join(ROOT, '.superpowers', 'excel-migration', 'dry-run-output.json');

// ---------------------------------------------------------------------------------------
// Fixed, reviewed order. Every entry here is one of the tables explicitly approved for
// delete-then-reinsert in migration-plan.md §6. categories/subcategories/payment_methods/
// budgets/households/household_users are intentionally NEVER in this list.
// ---------------------------------------------------------------------------------------
const DELETE_ORDER = [
  'transaction_event_details',
  'transaction_support_details',
  'transactions',
  'loan_payments',
  'loans',
  'investment_transactions',
  'cards',
  'accounts',
  'assets',
  'deposits',
  'savings_accounts',
  'insurances',
  'event_records',
  'support_programs',
];

const FORBIDDEN_TABLES = ['categories', 'subcategories', 'payment_methods', 'budgets', 'households', 'household_users'];

// ---------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

// Strips every `_`-prefixed metadata/traceability field (added by dry-run.cjs: _source,
// _tempId, _category_name, _repayment_method_raw, etc.) so only real DB columns remain.
function stripMeta(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('_')) out[key] = value;
  }
  return out;
}

// Rows known (from dry-run-output.json's own validation) to violate a NOT NULL/CHECK
// constraint if inserted as-is. Rather than let the DB reject the whole batch, these are
// filtered out up front and reported — never silently dropped, never fabricated.
const PRE_INSERT_REQUIRED = {
  assets: ['valuation_date'],
  loans: ['repayment_method', 'loan_date', 'first_payment_date', 'maturity_date'],
};

function preInsertIssues(table, row) {
  const required = PRE_INSERT_REQUIRED[table];
  if (!required) return [];
  return required.filter((field) => row[field] === null || row[field] === undefined);
}

async function safeDeleteForHousehold(table) {
  if (!DELETE_ORDER.includes(table) || FORBIDDEN_TABLES.includes(table)) {
    throw new Error(`안전장치: "${table}" 은(는) 승인된 삭제 대상 목록에 없습니다.`);
  }
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('household_id', HOUSEHOLD_ID);
  if (error) throw new Error(`DELETE 실패 (${table}): ${error.message}`);
  return count ?? 0;
}

async function countForHousehold(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('household_id', HOUSEHOLD_ID);
  if (error) throw new Error(`COUNT 실패 (${table}): ${error.message}`);
  return count ?? 0;
}

async function insertChunked(table, rows, { chunkSize = 500 } = {}) {
  let inserted = 0;
  const errors = [];
  for (const part of chunk(rows, chunkSize)) {
    if (part.length === 0) continue;
    const { error, count } = await supabase.from(table).insert(part, { count: 'exact' });
    if (error) {
      errors.push({ message: error.message, rowCount: part.length, sample: part[0] });
      continue; // keep trying remaining chunks — one bad chunk shouldn't abort the whole table
    }
    inserted += count ?? part.length;
  }
  return { inserted, errors };
}

async function findUserIdByEmail(email) {
  let page = 1;
  const perPage = 200;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.admin.listUsers 실패: ${error.message}`);
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

// ---------------------------------------------------------------------------------------
// Reference-data lookups (READ ONLY — categories/subcategories/payment_methods are never
// written by this script under any flag).
// ---------------------------------------------------------------------------------------

async function fetchCategoryMap() {
  const { data, error } = await supabase.from('categories').select('id, name, transaction_type').eq('household_id', HOUSEHOLD_ID);
  if (error) throw new Error(`categories 조회 실패: ${error.message}`);
  const map = new Map();
  for (const row of data ?? []) map.set(`${row.transaction_type}|${row.name}`, row.id);
  return map;
}

async function fetchSubcategoryMap() {
  // Embedded-resource filter (PostgREST): only subcategories whose parent category belongs to
  // this household. Read-only.
  const { data, error } = await supabase
    .from('subcategories')
    .select('id, name, category_id, categories!inner(id, household_id)')
    .eq('categories.household_id', HOUSEHOLD_ID);
  if (error) throw new Error(`subcategories 조회 실패: ${error.message}`);
  const map = new Map();
  for (const row of data ?? []) map.set(`${row.category_id}|${row.name}`, row.id);
  return map;
}

async function fetchPaymentMethodMap() {
  const { data, error } = await supabase.from('payment_methods').select('id, name').eq('household_id', HOUSEHOLD_ID);
  if (error) throw new Error(`payment_methods 조회 실패: ${error.message}`);
  const map = new Map();
  for (const row of data ?? []) map.set(row.name, row.id);
  return map;
}

// 2026-09-03 user decision, based on scripts/excel-migration/unmatched-names-report.md's
// evidence (항목 sheet history + actual sibling-subcategory overlap) — ONLY these exact-name
// aliases are applied, hardcoded, no fuzzy/guessed matching beyond what was explicitly reviewed
// and approved. Everything else that fails exact match still falls through to null +
// needs_review + a memo note, unchanged.
const CATEGORY_NAME_ALIASES = {
  '경조사회비': '이벤트지출', // legacy 2023 sheet label; every later year's 항목 sheet uses 이벤트지출, and its
  // sibling subcategories (축의금/선물) match 이벤트지출's real subcategories exactly.
  '경조사수입': '수입', // income has exactly one category in this household by design ("수입") — structural, not a guess.
  '정부지원금': '수입', // same structural reasoning as above.
};
// Applies only under the (post-alias) "이벤트지출" category — 부의금/부조금 are near-synonyms for
// condolence money and 이벤트지출 already has a real "부조금" subcategory but no "부의금" one.
const SUBCATEGORY_ALIAS_UNDER_EVENT_CATEGORY = { 부의금: '부조금' };
const EVENT_EXPENSE_CATEGORY_NAME = '이벤트지출';
// These two category aliases carry no real subcategory to map (support/event-income rows never
// had one) — explicitly suppressed rather than attempted, per instruction.
const CATEGORY_ALIASES_WITH_NO_SUBCATEGORY = new Set(['경조사수입', '정부지원금']);
const PAYMENT_METHOD_NAME_ALIASES = {
  현대카드: '현대신용',
  우리카드: '우리신용',
};
// "현금/계좌이체(원본 미기재)" (dry-run.cjs's own placeholder for a payment-method column that
// does not exist in the source 축의금&부조금 sheet at all) is intentionally NOT aliased — there is
// no real value to recover, only a guess, which was explicitly rejected.

// Resolves one transaction row's category/subcategory/payment_method names (raw text left by
// dry-run.cjs) against the household's EXISTING reference data by EXACT name match (after
// applying only the reviewed aliases above) — no fuzzy/guessed matching. Anything that still
// doesn't match is reported as a failure (caller nulls the FK + sets needs_review + annotates
// memo) rather than invented or silently dropped.
function resolveTransactionMapping(row, maps) {
  const categoryType = row.transaction_type === 'refund' ? 'expense' : row.transaction_type;
  const failures = [];
  let categoryId = null;
  let subcategoryId = null;
  let paymentMethodId = null;
  let categoryAliasWithNoSubcategoryApplied = false;

  const rawCategoryName = row._category_name;
  const aliasedCategoryName = rawCategoryName ? (CATEGORY_NAME_ALIASES[rawCategoryName] ?? rawCategoryName) : null;

  if (rawCategoryName) {
    categoryId = maps.categoryMap.get(`${categoryType}|${aliasedCategoryName}`) ?? null;
    if (!categoryId) failures.push(`카테고리 '${rawCategoryName}'`);
    else if (CATEGORY_ALIASES_WITH_NO_SUBCATEGORY.has(rawCategoryName)) categoryAliasWithNoSubcategoryApplied = true;
  }

  if (row._subcategory_name && categoryId && categoryAliasWithNoSubcategoryApplied) {
    // Explicitly suppressed — 경조사수입/정부지원금 rows never carry a real subcategory; leave null.
    subcategoryId = null;
  } else if (row._subcategory_name && categoryId) {
    const rawSubName = row._subcategory_name;
    const aliasedSubName = aliasedCategoryName === EVENT_EXPENSE_CATEGORY_NAME && SUBCATEGORY_ALIAS_UNDER_EVENT_CATEGORY[rawSubName] ? SUBCATEGORY_ALIAS_UNDER_EVENT_CATEGORY[rawSubName] : rawSubName;
    subcategoryId = maps.subcategoryMap.get(`${categoryId}|${aliasedSubName}`) ?? null;
    if (!subcategoryId) failures.push(`소분류 '${rawSubName}'`);
  } else if (row._subcategory_name && !categoryId) {
    failures.push(`소분류 '${row._subcategory_name}' (상위 카테고리 매핑 실패로 확인 불가)`);
  }

  if (row._payment_method_name) {
    const aliasedPmName = PAYMENT_METHOD_NAME_ALIASES[row._payment_method_name] ?? row._payment_method_name;
    paymentMethodId = maps.paymentMethodMap.get(aliasedPmName) ?? null;
    if (!paymentMethodId) failures.push(`결제수단 '${row._payment_method_name}'`);
  }
  // account_id resolution (by name, against the accounts freshly inserted in step 2) — wired for
  // completeness per the requested design, but the current dry-run-output.json's transaction
  // rows carry no `_account_name` field (the source monthly sheets' "구분" column is a payment
  // method label, not an account name), so this path is a no-op today; left in place in case a
  // future dry-run revision adds that field.
  let accountId = null;
  if (row._account_name && maps.accountMap) {
    accountId = maps.accountMap.get(row._account_name) ?? null;
    if (!accountId) failures.push(`계좌 '${row._account_name}'`);
  }

  return { categoryId, subcategoryId, paymentMethodId, accountId, failures, categoryAliasWithNoSubcategoryApplied, rawCategoryName };
}

function buildTransactionInsertRow(row, mapping, createdByUserId) {
  const notes = [];
  if (mapping.failures.length > 0) notes.push(`[매핑 실패: ${mapping.failures.join(', ')}]`);
  // 2026-09-03 user decision: 경조사수입→수입 alias rows get an explicit note that the category
  // was auto-assigned without a real subcategory, distinct from a genuine mapping failure.
  if (mapping.categoryAliasWithNoSubcategoryApplied && mapping.rawCategoryName === '경조사수입') {
    notes.push('[원본 소분류 없음, 카테고리만 자동배정: 경조사수입→수입]');
  }
  const combinedNote = notes.length > 0 ? notes.join(' ') : null;
  return {
    id: row.id,
    household_id: HOUSEHOLD_ID,
    created_by_user_id: createdByUserId,
    transaction_date: row.transaction_date,
    source_month: row.source_month ?? null,
    transaction_type: row.transaction_type,
    flow_class: row.flow_class,
    cost_behavior: row.cost_behavior,
    category_id: mapping.categoryId,
    subcategory_id: mapping.subcategoryId,
    payment_method_id: mapping.paymentMethodId,
    account_id: mapping.accountId,
    amount: row.amount,
    description: row.description,
    memo: combinedNote ? [row.memo, combinedNote].filter(Boolean).join(' ') : row.memo ?? null,
    include_in_budget: row.include_in_budget,
    needs_review: Boolean(row.needs_review) || mapping.failures.length > 0 || mapping.categoryAliasWithNoSubcategoryApplied,
    status: row.status,
  };
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(78));
  console.log(`Excel -> DB 마이그레이션 실행 스크립트  (모드: ${EXECUTE ? '*** EXECUTE (실제 DB 반영) ***' : 'DRY RUN (읽기 전용, DB에 아무것도 쓰지 않음)'})`);
  console.log('='.repeat(78));

  if (!fs.existsSync(DRY_RUN_OUTPUT_PATH)) {
    throw new Error(`입력 파일이 없습니다: ${DRY_RUN_OUTPUT_PATH} — 먼저 scripts/excel-migration/dry-run.cjs 를 실행하세요.`);
  }
  const data = JSON.parse(fs.readFileSync(DRY_RUN_OUTPUT_PATH, 'utf8'));

  // --- 0. Resolve created_by_user_id up front. Abort immediately if not found — never invent
  // a UUID. This is a read-only admin API call, safe to run in both modes.
  console.log(`\n[0] ${CREATED_BY_EMAIL} 사용자 조회 중...`);
  const createdByUserId = await findUserIdByEmail(CREATED_BY_EMAIL);
  if (!createdByUserId) {
    throw new Error(`auth.users 에서 이메일 "${CREATED_BY_EMAIL}" 을(를) 찾을 수 없습니다. 임의 UUID를 사용하지 않고 중단합니다 — 해당 계정이 실제로 존재하는지, 이메일 표기가 맞는지 확인해주세요.`);
  }
  console.log(`    -> created_by_user_id = ${createdByUserId}`);

  // --- 1. Deletion plan / execution (household_id-scoped only) ---------------------------
  console.log(`\n[1] 삭제 대상 (household_id = ${HOUSEHOLD_ID} 조건, 다른 household는 절대 건드리지 않음)`);
  const deleteCounts = {};
  for (const table of DELETE_ORDER) {
    deleteCounts[table] = await countForHousehold(table);
  }
  console.log('    현재 이 household의 기존 행 수 (삭제 대상):');
  for (const table of DELETE_ORDER) console.log(`      - ${table}: ${deleteCounts[table]}건`);

  const actualDeleteCounts = {};
  if (EXECUTE) {
    console.log('\n    *** 실제 삭제 실행 중 ***');
    for (const table of DELETE_ORDER) {
      actualDeleteCounts[table] = await safeDeleteForHousehold(table);
      console.log(`      - ${table}: ${actualDeleteCounts[table]}건 삭제됨`);
    }
  } else {
    console.log('\n    (DRY RUN — 위 건수만큼 삭제될 예정. 실제 DELETE는 실행하지 않음)');
  }

  // --- 2. Reference-data lookups (read-only, always) -------------------------------------
  console.log('\n[2] 기존 categories/subcategories/payment_methods 조회 중 (읽기 전용, 절대 수정하지 않음)...');
  const categoryMap = await fetchCategoryMap();
  const subcategoryMap = await fetchSubcategoryMap();
  const paymentMethodMap = await fetchPaymentMethodMap();
  console.log(`    categories: ${categoryMap.size}건, subcategories: ${subcategoryMap.size}건, payment_methods: ${paymentMethodMap.size}건 조회됨`);

  // --- 3. Mapping-failure preview for transactions (read-only computation) ---------------
  console.log('\n[3] transactions 카테고리/소분류/결제수단 매핑 미리보기 (정확히 일치하는 이름만 매핑, 추측 매핑 없음)');
  const previewMaps = { categoryMap, subcategoryMap, paymentMethodMap, accountMap: null };
  let mappingFailureCount = 0;
  const mappingFailureSamples = [];
  for (const row of data.transactions) {
    const mapping = resolveTransactionMapping(row, previewMaps);
    if (mapping.failures.length > 0) {
      mappingFailureCount += 1;
      if (mappingFailureSamples.length < 15) mappingFailureSamples.push({ description: row.description, failures: mapping.failures, source: row._source });
    }
  }
  console.log(`    예상 매핑 실패: ${mappingFailureCount} / ${data.transactions.length}건 (category_id/subcategory_id/payment_method_id 중 하나 이상 null + needs_review=true 처리될 예정)`);
  if (mappingFailureSamples.length > 0) {
    console.log('    실패 샘플(최대 15건):');
    for (const s of mappingFailureSamples) console.log(`      - "${s.description}" (${JSON.stringify(s.source)}): ${s.failures.join('; ')}`);
  }

  // --- 4. Insertion plan summary (always printed) ----------------------------------------
  console.log('\n[4] 삽입 예정 건수 (dry-run-output.json 기준)');
  const insertPlanTables = ['accounts', 'cards', 'assets', 'deposits', 'savings_accounts', 'insurances', 'loans', 'loan_payments', 'transactions', 'transaction_support_details', 'transaction_event_details', 'investment_transactions'];
  for (const table of insertPlanTables) console.log(`      - ${table}: ${(data[table] ?? []).length}건`);

  // Pre-insert validation preview (rows that would violate a known NOT NULL constraint).
  let preInsertSkipPreview = 0;
  for (const table of Object.keys(PRE_INSERT_REQUIRED)) {
    for (const row of data[table] ?? []) {
      if (preInsertIssues(table, row).length > 0) preInsertSkipPreview += 1;
    }
  }
  if (preInsertSkipPreview > 0) {
    console.log(`\n    주의: 사전 검증 결과 ${preInsertSkipPreview}건은 NOT NULL 제약 위반이 확실해(예: assets.valuation_date) 삽입 시 자동으로 제외되고 별도로 보고됩니다(임의 값 채우지 않음).`);
  }

  if (!EXECUTE) {
    console.log('\n' + '='.repeat(78));
    console.log('DRY RUN 완료 — 실제 DELETE/INSERT는 0건 실행되었습니다 (위 SELECT/COUNT 조회만 수행).');
    console.log('실제로 DB에 반영하려면: node scripts/excel-migration/execute-migration.cjs --execute');
    console.log('='.repeat(78));
    return;
  }

  // =========================================================================================
  // EXECUTE MODE — everything below performs real writes.
  // =========================================================================================

  const report = { inserted: {}, skipped: {}, errors: {} };

  function recordSkip(table, count) {
    if (count > 0) report.skipped[table] = (report.skipped[table] ?? 0) + count;
  }
  function recordErrors(table, errors) {
    if (errors.length > 0) report.errors[table] = (report.errors[table] ?? []).concat(errors);
  }

  // --- Step 2: snapshot tables (no cross-references except loans -> loan_payments) --------
  console.log('\n[5] 스냅샷 테이블 삽입 중...');
  for (const table of ['accounts', 'cards', 'assets', 'deposits', 'savings_accounts', 'insurances']) {
    const rows = (data[table] ?? []).filter((row) => {
      const issues = preInsertIssues(table, row);
      if (issues.length > 0) {
        recordSkip(table, 1);
        return false;
      }
      return true;
    });
    const toInsert = rows.map((row) => ({ id: crypto.randomUUID(), ...stripMeta(row), household_id: HOUSEHOLD_ID, created_by_user_id: createdByUserId }));
    const { inserted, errors } = await insertChunked(table, toInsert);
    report.inserted[table] = inserted;
    recordErrors(table, errors);
    console.log(`    - ${table}: ${inserted}건 삽입 (스킵 ${report.skipped[table] ?? 0}건, 오류 ${errors.length}건)`);
  }

  // --- loans (explicit client-generated id so loan_payments can reference it deterministically,
  //     independent of any insert-return row ordering) --------------------------------------
  console.log('\n[6] loans + loan_payments 삽입 중...');
  const loanIdMap = new Map(); // dry-run _tempId -> real inserted id
  const loanRowsToInsert = [];
  for (const row of data.loans ?? []) {
    const issues = preInsertIssues('loans', row);
    if (issues.length > 0) {
      recordSkip('loans', 1);
      continue;
    }
    const id = crypto.randomUUID();
    if (row._tempId) loanIdMap.set(row._tempId, id);
    loanRowsToInsert.push({ id, ...stripMeta(row), household_id: HOUSEHOLD_ID, created_by_user_id: createdByUserId });
  }
  {
    const { inserted, errors } = await insertChunked('loans', loanRowsToInsert);
    report.inserted.loans = inserted;
    recordErrors('loans', errors);
    console.log(`    - loans: ${inserted}건 삽입 (스킵 ${report.skipped.loans ?? 0}건, 오류 ${errors.length}건)`);
  }

  const loanPaymentRowsToInsert = [];
  let loanPaymentsSkippedNoLoan = 0;
  for (const row of data.loan_payments ?? []) {
    const loanId = loanIdMap.get(row._loan_ref);
    if (!loanId) {
      loanPaymentsSkippedNoLoan += 1;
      continue; // its parent loan failed pre-insert validation or insert — cannot attach safely
    }
    loanPaymentRowsToInsert.push({ id: crypto.randomUUID(), ...stripMeta(row), loan_id: loanId, household_id: HOUSEHOLD_ID, created_by_user_id: createdByUserId });
  }
  recordSkip('loan_payments', loanPaymentsSkippedNoLoan);
  {
    const { inserted, errors } = await insertChunked('loan_payments', loanPaymentRowsToInsert);
    report.inserted.loan_payments = inserted;
    recordErrors('loan_payments', errors);
    console.log(`    - loan_payments: ${inserted}건 삽입 (스킵 ${report.skipped.loan_payments ?? 0}건, 오류 ${errors.length}건)`);
  }

  // --- transactions (category/subcategory/payment_method resolved by exact name match) ----
  console.log('\n[7] transactions 삽입 중 (카테고리/결제수단 이름 매핑 포함)...');
  const execMaps = { categoryMap, subcategoryMap, paymentMethodMap, accountMap: null };
  const txnIdMap = new Map(); // dry-run _tempId -> real inserted id (for support/event detail rows)
  let txnMappingFailures = 0;
  const transactionRowsToInsert = [];
  for (const row of data.transactions ?? []) {
    const id = crypto.randomUUID();
    if (row._tempId) txnIdMap.set(row._tempId, id);
    const mapping = resolveTransactionMapping(row, execMaps);
    if (mapping.failures.length > 0) txnMappingFailures += 1;
    transactionRowsToInsert.push(buildTransactionInsertRow({ ...row, id }, mapping, createdByUserId));
  }
  {
    const { inserted, errors } = await insertChunked('transactions', transactionRowsToInsert);
    report.inserted.transactions = inserted;
    recordErrors('transactions', errors);
    console.log(`    - transactions: ${inserted}건 삽입 (오류 ${errors.length}건)`);
    console.log(`    - 카테고리/소분류/결제수단 매핑 실패로 needs_review=true 처리된 행: ${txnMappingFailures}건`);
  }

  // --- transaction_support_details / transaction_event_details (linked via txnIdMap) ------
  console.log('\n[8] transaction_support_details / transaction_event_details 삽입 중...');
  for (const table of ['transaction_support_details', 'transaction_event_details']) {
    const rows = [];
    let skippedNoTxn = 0;
    for (const row of data[table] ?? []) {
      const txnId = txnIdMap.get(row._transaction_ref);
      if (!txnId) {
        skippedNoTxn += 1;
        continue;
      }
      rows.push({ ...stripMeta(row), transaction_id: txnId, household_id: HOUSEHOLD_ID, created_by_user_id: createdByUserId });
    }
    recordSkip(table, skippedNoTxn);
    const { inserted, errors } = await insertChunked(table, rows);
    report.inserted[table] = inserted;
    recordErrors(table, errors);
    console.log(`    - ${table}: ${inserted}건 삽입 (스킵 ${skippedNoTxn}건, 오류 ${errors.length}건)`);
  }

  // --- investment_transactions -------------------------------------------------------------
  console.log('\n[9] investment_transactions 삽입 중...');
  {
    const rows = (data.investment_transactions ?? []).map((row) => ({ id: crypto.randomUUID(), ...stripMeta(row), household_id: HOUSEHOLD_ID, created_by_user_id: createdByUserId }));
    const { inserted, errors } = await insertChunked('investment_transactions', rows);
    report.inserted.investment_transactions = inserted;
    recordErrors('investment_transactions', errors);
    console.log(`    - investment_transactions: ${inserted}건 삽입 (오류 ${errors.length}건)`);
  }

  // --- Step 10: post-insert verification (re-count vs expected, never aborts) -------------
  console.log('\n[10] 삽입 후 검증 (SELECT COUNT(*) vs dry-run-output.json 건수 비교)');
  const expectedCounts = {
    accounts: (data.accounts ?? []).length,
    cards: (data.cards ?? []).length,
    assets: (data.assets ?? []).length - (report.skipped.assets ?? 0),
    deposits: (data.deposits ?? []).length,
    savings_accounts: (data.savings_accounts ?? []).length,
    insurances: (data.insurances ?? []).length,
    loans: (data.loans ?? []).length - (report.skipped.loans ?? 0),
    loan_payments: (data.loan_payments ?? []).length - (report.skipped.loan_payments ?? 0),
    transactions: (data.transactions ?? []).length,
    transaction_support_details: (data.transaction_support_details ?? []).length - (report.skipped.transaction_support_details ?? 0),
    transaction_event_details: (data.transaction_event_details ?? []).length - (report.skipped.transaction_event_details ?? 0),
    investment_transactions: (data.investment_transactions ?? []).length,
  };
  const verification = {};
  let anyMismatch = false;
  for (const table of Object.keys(expectedCounts)) {
    const actual = await countForHousehold(table);
    const expected = expectedCounts[table];
    const match = actual === expected;
    if (!match) anyMismatch = true;
    verification[table] = { expected, actual, match };
    console.log(`    - ${table}: 기대 ${expected}건 / 실제 ${actual}건 ${match ? 'OK' : '*** 불일치 ***'}`);
  }

  // --- Final report -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(78));
  console.log('실행 완료 요약');
  console.log('='.repeat(78));
  console.log('삭제된 건수:', JSON.stringify(actualDeleteCounts, null, 2));
  console.log('삽입된 건수:', JSON.stringify(report.inserted, null, 2));
  if (Object.keys(report.skipped).length > 0) console.log('사전검증/연결실패로 스킵된 건수:', JSON.stringify(report.skipped, null, 2));
  if (Object.keys(report.errors).length > 0) {
    console.log('*** DB 오류 발생 (해당 청크만 실패, 나머지는 계속 진행됨) ***');
    for (const [table, errs] of Object.entries(report.errors)) {
      console.log(`  - ${table}: ${errs.length}건`);
      for (const e of errs) console.log(`      rowCount=${e.rowCount} message=${e.message}`);
    }
  }
  console.log(`카테고리/결제수단 매핑 실패로 needs_review 처리된 transactions: ${txnMappingFailures}건`);
  console.log(anyMismatch ? '*** 검증 결과 일부 테이블 건수 불일치 — 위 [10] 로그 참고 ***' : '검증 결과: 모든 테이블 건수 일치');
  console.log('='.repeat(78));
}

main().catch((err) => {
  console.error('\n마이그레이션 스크립트가 오류로 중단되었습니다:');
  console.error(err);
  process.exit(1);
});
