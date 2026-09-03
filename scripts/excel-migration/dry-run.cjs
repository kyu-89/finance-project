'use strict';
/**
 * Excel -> DB migration: DRY RUN (parsing + in-memory validation only).
 *
 * NO DATABASE ACCESS OF ANY KIND HAPPENS IN THIS SCRIPT. No Supabase client is created,
 * imported, or referenced. This script only reads the 4 source .xlsm workbooks with the
 * `xlsx` package (same calling convention as `.superpowers/dump_sheet.cjs` /
 * `.superpowers/list_sheets.cjs`: `XLSX.readFile(file, { cellDates: true })` +
 * `XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })`), re-implements
 * (in plain JS) the parsing behavior documented in
 * `.superpowers/excel-migration/parser-analysis.md`, validates the parsed rows against the
 * exact DB CHECK constraints documented there, and writes:
 *   - .superpowers/excel-migration/dry-run-output.json  (per-table arrays of DB-column-shaped rows)
 *   - .superpowers/excel-migration/dry-run-summary.md    (human-readable counts + errors + gaps)
 *
 * See `.superpowers/excel-migration/migration-plan.md` for the approved mapping this follows.
 *
 * Run: node scripts/excel-migration/dry-run.cjs
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..', '..');
// Outputs carry real transaction descriptions/names/amounts — kept in the gitignored scratch
// dir (see .gitignore's /.superpowers/ entry), never alongside this committed script.
const OUTPUT_DIR = path.join(ROOT, '.superpowers', 'excel-migration');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const FILES = ['2023년.xlsm', '2024년.xlsm', '2025년.xlsm', '2026년.xlsm'];
const YEARS = [2023, 2024, 2025, 2026];
const MONTH_SHEETS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

// ---------------------------------------------------------------------------------------
// Workbook loading
// ---------------------------------------------------------------------------------------

const workbooks = {}; // file -> XLSX.WorkBook
for (const file of FILES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    throw new Error(`필수 원본 파일을 찾을 수 없습니다: ${full}`);
  }
  workbooks[file] = XLSX.readFile(full, { cellDates: true });
}

function sheetRows(file, sheetName) {
  const wb = workbooks[file];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

function hasSheet(file, sheetName) {
  return Boolean(workbooks[file].Sheets[sheetName]);
}

// ---------------------------------------------------------------------------------------
// Shared primitives (ported from src/lib/transaction-import.ts)
// ---------------------------------------------------------------------------------------

function text(value) {
  return String(value ?? '').trim();
}

// Superset of the various per-file `normalize`/`norm` helpers in src/lib/excel-*.ts (they all
// do NFKC-lowercase plus stripping a similar punctuation/whitespace class; stripping a superset
// of characters cannot cause a false non-match for any of the real header labels used below).
function normKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s _\-()[\]{}:/\\.·]/g, '');
}

function findCol(headerRow, aliases) {
  return (headerRow || []).findIndex((header) => {
    const current = normKey(header);
    if (!current) return false;
    return aliases.some((alias) => {
      const target = normKey(alias);
      return target && (current === target || current.includes(target));
    });
  });
}

function rowHasData(row) {
  return (row || []).some((value) => String(value ?? '').trim() !== '');
}

function formatDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Verbatim port of normalizeImportDate (src/lib/transaction-import.ts).
function normalizeImportDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const t = String(value ?? '').trim();
  if (!t) return null;
  const compact = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return formatDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  const match = t.match(/^(\d{2,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (!match) return null;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  return formatDate(year, Number(match[2]), Number(match[3]));
}

// Verbatim port of normalizeImportAmount (src/lib/transaction-import.ts).
function normalizeImportAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { amount: Math.abs(Math.round(value)), negative: value < 0 };
  }
  const t = String(value ?? '').trim();
  if (!t) return { amount: null, negative: false };
  const negative = /^[-₩원\s]*-/.test(t) || /-$/.test(t) || /^\(.*\)$/.test(t);
  const numeric = Number(
    t
      .replace(/[₩원,\s]/g, '')
      .replace(/^\((.*)\)$/, '$1')
      .replace(/-$/, ''),
  );
  return Number.isFinite(numeric) ? { amount: Math.abs(Math.round(numeric)), negative } : { amount: null, negative };
}

// Signed money helper used by several domain parsers (money()/amount() in excel-*.ts).
function signedMoney(value) {
  const parsed = normalizeImportAmount(value);
  if (parsed.amount === null) return null;
  return parsed.negative ? -parsed.amount : parsed.amount;
}

// percent() from excel-loan-insurance-import.ts
function percent(value) {
  const parsed = Number(String(value ?? '').replace('%', ''));
  return Number.isFinite(parsed) ? parsed / (parsed > 1 ? 100 : 1) : null;
}

// rate() from excel-savings-import.ts
function rate(value) {
  const parsed = Number(String(value ?? '').replace('%', '').trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function isRefund(memo) {
  return /취소|환불|반품|cancel|refund|return/i.test(String(memo ?? ''));
}

// ---------------------------------------------------------------------------------------
// Result accumulators
// ---------------------------------------------------------------------------------------

const output = {
  transactions: [],
  transaction_support_details: [],
  transaction_event_details: [],
  accounts: [],
  cards: [],
  assets: [],
  deposits: [],
  savings_accounts: [],
  loans: [],
  loan_payments: [],
  insurances: [],
  investment_transactions: [],
};

const validationErrors = []; // { table, file, sheet, rowIndex, message }
const unmapped = []; // { file, sheet, rowIndex, reason, raw }
const findings = []; // free-text notes about parser gaps / deliberate deviations discovered while parsing
const skippedOutOfScope = []; // { file, sheet, reason }
// Rows where a required date could not be read from the source and, per explicit user
// approval (2026-09-03), were given an estimated transaction_date (the 1st of January of the
// source workbook's year) + needs_review=true instead of being excluded — tracked separately
// so the estimate is visible in the report rather than hidden inside the normal counts.
const estimatedDateItems = []; // { table, file, sheet, rowIndex, description, estimatedDate }

function addEstimatedDate(table, file, sheet, rowIndex, description, estimatedDate) {
  estimatedDateItems.push({ table, file, sheet, rowIndex, description, estimatedDate });
}

function source(file, sheet, rowIndex) {
  return { file, sheet, rowIndex };
}

function addError(table, file, sheet, rowIndex, message) {
  validationErrors.push({ table, file, sheet, rowIndex, message });
}

function addUnmapped(file, sheet, rowIndex, reason, raw) {
  unmapped.push({ file, sheet, rowIndex, reason, raw: raw === undefined ? undefined : JSON.stringify(raw) });
}

let tempIdCounter = 0;
function nextTempId(prefix) {
  tempIdCounter += 1;
  return `${prefix}-${tempIdCounter}`;
}

// ---------------------------------------------------------------------------------------
// 1. Monthly transaction sheets (1월~12월, all 4 years) — port of mapMonthlySheetRows
//    (src/lib/transaction-import.ts §1.9 in parser-analysis.md)
// ---------------------------------------------------------------------------------------

const FLOW_CLASS_BY_TRANSACTION_TYPE = {
  income: 'cash_in',
  expense: 'consumption',
  refund: 'cash_in',
};

function mapMonthlySheetRows(rows) {
  const blocks = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let start = 0; start < row.length; start += 1) {
      if (String(row[start] ?? '').trim() !== '날짜') continue;
      const next = String(row[start + 1] ?? '').trim();
      if (next === '대분류') blocks.push({ headerRow: rowIndex, start, kind: 'income' });
      if (next === '구분') blocks.push({ headerRow: rowIndex, start, kind: 'expense' });
    }
  }
  const result = [];
  for (const block of blocks) {
    const nextHeader = blocks.find((candidate) => candidate.headerRow > block.headerRow)?.headerRow ?? rows.length;
    for (let index = block.headerRow + 1; index < nextHeader; index += 1) {
      const row = rows[index] ?? [];
      const data =
        block.kind === 'income'
          ? { date: row[block.start], category: row[block.start + 1], subcategory: row[block.start + 2], description: row[block.start + 3], amount: row[block.start + 4], payment: null, memo: null }
          : { date: row[block.start], category: row[block.start + 2], subcategory: row[block.start + 3], description: row[block.start + 4], amount: row[block.start + 5], payment: row[block.start + 1], memo: row[block.start + 7] };
      if (![data.date, data.category, data.description, data.amount, data.payment, data.memo].some((value) => String(value ?? '').trim() !== '')) continue;
      if (block.kind === 'income' && data.amount !== undefined && normalizeImportAmount(data.amount).amount === null && /사용|미정|확인/.test(String(data.amount))) continue;
      const parsedDate = normalizeImportDate(data.date);
      const parsedAmount = normalizeImportAmount(data.amount);
      const description = String(data.description ?? '').trim();
      // Blank dates / text-only or zero amounts are template placeholders, not posted
      // transactions — faithful port of the source's documented behavior (not an error).
      if (!parsedDate || !description || parsedAmount.amount === null || parsedAmount.amount <= 0) continue;
      result.push({
        rowNumber: index + 1,
        transactionDate: parsedDate,
        amount: parsedAmount.amount,
        transactionType: block.kind === 'income' ? 'income' : parsedAmount.negative || isRefund(data.memo) ? 'refund' : 'expense',
        description,
        categoryName: String(data.category ?? '').trim() || null,
        subcategoryName: String(data.subcategory ?? '').trim() || null,
        memo: String(data.memo ?? '').trim() || null,
        cardLabel: String(data.payment ?? '').trim() || null,
      });
    }
  }
  return result;
}

function buildTransactionRow(parsed, file, sheet, sourceMonth) {
  const row = {
    transaction_date: parsed.transactionDate,
    source_month: sourceMonth,
    transaction_type: parsed.transactionType,
    flow_class: FLOW_CLASS_BY_TRANSACTION_TYPE[parsed.transactionType],
    cost_behavior: parsed.transactionType === 'expense' ? 'variable' : null,
    category_id: null,
    subcategory_id: null,
    payment_method_id: null,
    account_id: null,
    amount: parsed.amount,
    description: parsed.description,
    memo: parsed.memo,
    include_in_budget: parsed.transactionType === 'expense',
    needs_review: parsed.transactionType === 'refund',
    status: 'posted',
    // Raw text for phase-2 (DB-connected) resolution against existing categories/subcategories/
    // payment_methods tables by name — this dry-run phase has no DB access to resolve FKs.
    _category_name: parsed.categoryName,
    _subcategory_name: parsed.subcategoryName,
    _payment_method_name: parsed.cardLabel,
    _source: source(file, sheet, parsed.rowNumber),
  };
  validateTransaction(row, file, sheet, parsed.rowNumber);
  return row;
}

function validateTransaction(row, file, sheet, rowIndex) {
  const table = 'transactions';
  if (!['income', 'expense', 'saving', 'investment', 'debt_principal', 'finance_cost', 'transfer', 'asset_adjustment', 'refund'].includes(row.transaction_type)) {
    addError(table, file, sheet, rowIndex, `transaction_type CHECK 위반: ${row.transaction_type}`);
  }
  if (!['cash_in', 'consumption', 'saving', 'investment', 'debt_principal', 'finance_cost', 'transfer', 'adjustment'].includes(row.flow_class)) {
    addError(table, file, sheet, rowIndex, `flow_class CHECK 위반: ${row.flow_class}`);
  }
  if (row.cost_behavior !== null && !['fixed', 'variable'].includes(row.cost_behavior)) {
    addError(table, file, sheet, rowIndex, `cost_behavior CHECK 위반: ${row.cost_behavior}`);
  }
  if (!Number.isSafeInteger(row.amount) || row.amount <= 0) {
    addError(table, file, sheet, rowIndex, `amount > 0 위반: ${row.amount}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.transaction_date))) {
    addError(table, file, sheet, rowIndex, `transaction_date 형식 오류: ${row.transaction_date}`);
  }
  if (row.source_month && !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(row.source_month)) {
    addError(table, file, sheet, rowIndex, `source_month 형식 오류: ${row.source_month}`);
  }
  if (!row.description || !row.description.trim()) {
    addError(table, file, sheet, rowIndex, 'description 비어 있음');
  }
  if (row.transaction_type !== 'income' && !row._payment_method_name) {
    addError(table, file, sheet, rowIndex, '결제수단(카드/구분) 정보 없음 — payment_method_id를 채울 수 없음 (실제 import 시 필수)');
  }
}

let monthlyTransactionCount = 0;
for (let yi = 0; yi < YEARS.length; yi += 1) {
  const year = YEARS[yi];
  const file = FILES[yi];
  for (let mi = 0; mi < MONTH_SHEETS.length; mi += 1) {
    const sheetName = MONTH_SHEETS[mi];
    const rows = sheetRows(file, sheetName);
    if (!rows) {
      addUnmapped(file, sheetName, null, '월별 시트를 찾을 수 없음', null);
      continue;
    }
    const sourceMonth = `${year}-${String(mi + 1).padStart(2, '0')}`;
    const parsed = mapMonthlySheetRows(rows);
    for (const p of parsed) {
      output.transactions.push(buildTransactionRow(p, file, sheetName, sourceMonth));
      monthlyTransactionCount += 1;
    }
  }
}

// ---------------------------------------------------------------------------------------
// 2. 업비트수익 + 업비트2 (2024+, cumulative — each year's workbook was found to carry the
//    FULL trade history up to that point, not just that year's slice, so dedupe across files
//    is required even though this mirrors the same "누적 재구축 + 중복 제거" the plan calls
//    out explicitly for Upbit; confirmed by inspecting the raw sheets before writing this).
// ---------------------------------------------------------------------------------------

// Port of parseInvestmentTradeRows (src/lib/excel-investment-import.ts).
const INVESTMENT_ALIASES = { date: ['거래일자', '거래일', 'date'], asset: ['코인', '종목', '자산', 'asset'], type: ['종류', '거래구분', 'type'] };
function hasAlias(value, list) {
  const current = normKey(value);
  return list.some((alias) => {
    const target = normKey(alias);
    return target && (current === target || current.includes(target));
  });
}
function tradeTypeOf(value) {
  const v = normKey(value);
  if (v.includes('매수') || v === 'buy') return 'buy';
  if (v.includes('매도') || v === 'sell') return 'sell';
  return null;
}
function parseInvestmentTradeRows(rows, maxRows = 60) {
  const result = [];
  for (let headerRow = 0; headerRow < Math.min(maxRows, rows.length); headerRow += 1) {
    const header = rows[headerRow] ?? [];
    for (let start = 0; start < header.length; start += 1) {
      if (!hasAlias(header[start], INVESTMENT_ALIASES.date) || !hasAlias(header[start + 1], INVESTMENT_ALIASES.asset) || !hasAlias(header[start + 2], INVESTMENT_ALIASES.type)) continue;
      for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
        const values = (rows[rowIndex] ?? []).slice(start, start + 7);
        if (!values.some((value) => String(value ?? '').trim())) continue;
        const date = normalizeImportDate(values[0]);
        const assetName = String(values[1] ?? '').trim();
        const kind = tradeTypeOf(values[2]);
        const unitPrice = normalizeImportAmount(values[3]);
        const tradeAmount = normalizeImportAmount(values[4]);
        const fee = normalizeImportAmount(values[5]);
        const settledAmount = normalizeImportAmount(values[6]);
        result.push({
          rowNumber: rowIndex + 1,
          tradeDate: date,
          assetName,
          tradeType: kind ?? 'buy',
          tradeTypeRaw: kind,
          unitPrice: unitPrice.amount,
          tradeAmount: tradeAmount.amount,
          fee: fee.amount,
          settledAmount: settledAmount.amount,
        });
      }
    }
  }
  return result;
}

const investmentSeen = new Map(); // dedupe key -> true
let investmentDuplicateCount = 0;
for (let yi = 0; yi < YEARS.length; yi += 1) {
  const file = FILES[yi];
  for (const sheetName of ['업비트수익', '업비트2']) {
    if (!hasSheet(file, sheetName)) continue;
    const rows = sheetRows(file, sheetName);
    const parsed = parseInvestmentTradeRows(rows);
    for (const p of parsed) {
      const key = `${p.tradeDate}|${p.assetName}|${p.tradeType}|${p.unitPrice}|${p.tradeAmount}|${p.fee}|${p.settledAmount}`;
      if (investmentSeen.has(key)) {
        investmentDuplicateCount += 1;
        continue;
      }
      investmentSeen.set(key, true);
      if (!p.tradeDate || !p.assetName || !p.tradeTypeRaw || p.unitPrice === null || p.tradeAmount === null || p.tradeAmount <= 0 || p.fee === null || p.settledAmount === null) {
        addUnmapped(file, sheetName, p.rowNumber, '투자거래 필수값 누락(거래일자/자산명/매수매도구분/단가/금액/수수료/정산금액 중 하나 이상)', p);
        continue;
      }
      const row = {
        trade_date: p.tradeDate,
        asset_name: p.assetName,
        trade_type: p.tradeType,
        unit_price: p.unitPrice,
        trade_amount: p.tradeAmount,
        fee: p.fee,
        settled_amount: p.settledAmount,
        memo: null,
        source: 'excel',
        _source: source(file, sheetName, p.rowNumber),
      };
      if (!['buy', 'sell'].includes(row.trade_type)) addError('investment_transactions', file, sheetName, p.rowNumber, `trade_type CHECK 위반: ${row.trade_type}`);
      if (!(row.trade_amount >= 0)) addError('investment_transactions', file, sheetName, p.rowNumber, `trade_amount >= 0 위반: ${row.trade_amount}`);
      output.investment_transactions.push(row);
    }
  }
}
findings.push(
  `업비트수익/업비트2: 매 연도 워크북이 그 해까지의 전체 누적 거래내역을 담고 있는 것으로 확인되어(예: 2026년.xlsm의 업비트2에 2021년 거래가 포함됨), 연도 파일 간 완전 중복 ${investmentDuplicateCount}건을 (거래일자|자산명|매수매도|단가|거래금액|수수료|정산금액) 키로 제거했습니다.`,
);

// ---------------------------------------------------------------------------------------
// 3. 정부지원금 (2024+, cumulative) — port of parseSupportRows (excel-support-event-import.ts)
// ---------------------------------------------------------------------------------------

function periodStart(value) {
  const match = value ? String(value).match(/(20\d{2})[./-](\d{1,2})(?:[./-](\d{1,2}))?/) : null;
  if (!match) return null;
  return normalizeImportDate(`${match[1]}-${match[2].padStart(2, '0')}-${(match[3] ?? '01').padStart(2, '0')}`);
}

function parseSupportRows(rows) {
  const headerIndex = rows.findIndex((row) => row.some((value) => text(value) === '지원금종류'));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex] ?? [];
  const find = (label) => header.findIndex((value) => text(value).includes(label));
  const c = {
    kind: find('지원금종류'),
    eligibility: find('자격'),
    application: find('신청기간'),
    receiving: find('수령기간'), // NOTE: real sheets use "사용기간" — see findings below (faithful port keeps this gap).
    amount: find('금액'),
    total: find('총 지원금'),
    status: find('지급여부'),
    issuer: find('접수처'),
  };
  const result = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const supportKind = text(row[c.kind]);
    if (!supportKind) return;
    const amountPerOccurrence = c.amount >= 0 ? signedMoney(row[c.amount]) : null;
    const totalExpectedAmount = c.total >= 0 ? signedMoney(row[c.total]) : null;
    const receivingPeriod = c.receiving >= 0 ? text(row[c.receiving]) || null : null;
    const applicationPeriod = c.application >= 0 ? text(row[c.application]) || null : null;
    result.push({
      rowNumber: headerIndex + offset + 2,
      supportKind,
      eligibility: c.eligibility >= 0 ? text(row[c.eligibility]) || null : null,
      applicationPeriod,
      receivingPeriod,
      expectedDate: periodStart(receivingPeriod) ?? periodStart(applicationPeriod),
      amountPerOccurrence,
      totalExpectedAmount,
      status: c.status >= 0 ? text(row[c.status]) : '',
      issuer: c.issuer >= 0 ? text(row[c.issuer]) || null : null,
    });
  });
  return result;
}

const SUPPORT_STATUS_MAP = [
  [/완료|지급완료|수령완료|지급됨/, 'completed'],
  [/거절|반려/, 'rejected'],
  [/만료|종료/, 'expired'],
  [/승인/, 'approved'],
  [/수령중|지급중/, 'receiving'],
  [/신청/, 'applied'],
  [/대상|자격/, 'eligible'],
];
function mapSupportStatus(raw) {
  const t = text(raw);
  for (const [re, mapped] of SUPPORT_STATUS_MAP) if (re.test(t)) return { status: mapped, confident: true };
  return { status: 'planned', confident: false };
}

let supportUnmappedNoAmount = 0;
let supportStatusGuessed = 0;
let supportEstimatedDateCount = 0;
let supportDuplicateCount = 0;

// 정부지원금 sheets were found to be the SAME kind of cumulative snapshot as 업비트/축의금&부조금:
// 2025년.xlsm and 2026년.xlsm carry byte-identical 79-row lists, and 2024년.xlsm carries a
// 64-row subset of that same list (confirmed by dumping all 3 files) — so cross-file dedup is
// required here too, not just an append. Dedupe by supportKind (the item name is effectively
// the catalog key in this sheet), preferring the latest year's version since a few items' 사용
// 기간/지급여부 text visibly changes between years as the item's real-world status progresses
// (e.g. "임신출산 진료비" changes from "출생~2년" in 2024 to a concrete "26.12.08" in 2025/2026).
const supportSeen = new Map(); // supportKind -> { file, sheetName, yearIndex, p }
for (let yi = 0; yi < YEARS.length; yi += 1) {
  const file = FILES[yi];
  const sheetName = '정부지원금';
  if (!hasSheet(file, sheetName)) continue;
  const rows = sheetRows(file, sheetName);
  const parsed = parseSupportRows(rows);
  for (const p of parsed) {
    const key = p.supportKind.trim();
    const existing = supportSeen.get(key);
    if (existing) {
      supportDuplicateCount += 1;
      if (existing.yearIndex >= yi) continue; // keep the newer (or same-year first) version
    }
    supportSeen.set(key, { file, sheetName, yearIndex: yi, p });
  }
}
for (const { file, sheetName, yearIndex: yi, p } of supportSeen.values()) {
  const amount = p.totalExpectedAmount ?? p.amountPerOccurrence;
    if (amount === null || amount <= 0) {
      // Amount is genuinely unrecoverable — user approval only covers the missing-DATE case
      // (see 2026-09-03 decision below), so this still cannot become a valid transaction row.
      supportUnmappedNoAmount += 1;
      addUnmapped(file, sheetName, p.rowNumber, `정부지원금 항목 "${p.supportKind}" 매핑 불가: 금액/총 지원금 컬럼에서 유효한 금액을 읽지 못함`, p);
      continue;
    }
    // 2026-09-03 user decision: rows with no resolvable absolute date are no longer excluded.
    // Use Jan 1 of the source workbook's year as an explicit placeholder date, flag
    // needs_review, and record the estimation basis in memo instead of silently dropping.
    let transactionDate = p.expectedDate;
    let dateEstimated = false;
    if (!transactionDate) {
      transactionDate = `${YEARS[yi]}-01-01`;
      dateEstimated = true;
      supportEstimatedDateCount += 1;
      addEstimatedDate('transactions(정부지원금)', file, sheetName, p.rowNumber, p.supportKind, transactionDate);
    }
    const statusMapping = mapSupportStatus(p.status);
    if (!statusMapping.confident) supportStatusGuessed += 1;
    const tempId = nextTempId('txn-support');
    const txnRow = {
      _tempId: tempId,
      transaction_date: transactionDate,
      source_month: null,
      transaction_type: 'income',
      flow_class: 'cash_in',
      cost_behavior: null,
      category_id: null,
      subcategory_id: null,
      payment_method_id: null,
      account_id: null,
      amount,
      description: p.supportKind,
      memo: dateEstimated ? `[날짜 추정됨, 원문 신청기간: "${p.applicationPeriod || '정보 없음'}"]` : null,
      include_in_budget: false,
      needs_review: dateEstimated || !statusMapping.confident,
      status: 'posted',
      _category_name: '정부지원금',
      _subcategory_name: null,
      _payment_method_name: null,
      _source: source(file, sheetName, p.rowNumber),
    };
    validateTransaction(txnRow, file, sheetName, p.rowNumber);
    output.transactions.push(txnRow);
    const detailRow = {
      _transaction_ref: tempId,
      support_kind: p.supportKind,
      eligibility: p.eligibility,
      application_period: p.applicationPeriod,
      receiving_period: p.receivingPeriod,
      payout_cycle: null,
      expected_date: p.expectedDate,
      amount_per_occurrence: p.amountPerOccurrence,
      total_expected_amount: p.totalExpectedAmount,
      status: statusMapping.status,
      issuer: p.issuer,
      contact: null,
      source_url: null,
      memo: `원문 지급여부: ${p.status || '(없음)'}`,
      _source: source(file, sheetName, p.rowNumber),
    };
    if (!['planned', 'eligible', 'applied', 'approved', 'receiving', 'completed', 'rejected', 'expired'].includes(detailRow.status)) {
      addError('transaction_support_details', file, sheetName, p.rowNumber, `status CHECK 위반: ${detailRow.status}`);
    }
    output.transaction_support_details.push(detailRow);
}
findings.push(
  `정부지원금: 업비트/축의금&부조금과 마찬가지로 이 시트도 연도 워크북 간 누적 스냅샷임을 확인했습니다(2025/2026년.xlsm이 동일한 79행, 2024년.xlsm은 그 중 64행짜리 부분집합). 항목명(지원금종류)을 키로 ${supportDuplicateCount}건의 연도 간 중복을 제거하고 더 최신 연도의 내용을 채택했습니다(일부 항목은 "사용기간"/"지급여부" 값이 연도가 지나며 실제로 바뀜).`,
);
findings.push(
  `정부지원금: parseSupportRows의 "수령기간" 별칭이 실제 시트 헤더 "사용기간"과 일치하지 않아(파서 그대로 포팅) receivingPeriod가 항상 null로 나옵니다. "신청기간" 컬럼에서 절대 날짜를 2차로 시도했지만 대부분 "-" 또는 상대 기간 텍스트("출생~60일" 등)라 날짜를 못 얻습니다. 2026-09-03 사용자 승인에 따라, 금액은 확인되지만 날짜만 확정하지 못한 행 ${supportEstimatedDateCount}건은 제외하지 않고 해당 워크북 연도의 1월 1일을 transaction_date로 사용하고 needs_review=true, memo에 추정 근거를 남겼습니다 — "추정 날짜로 처리된 항목" 섹션 참고. 금액 자체를 못 읽은 ${supportUnmappedNoAmount}건은 여전히 unmapped로 남습니다(승인 범위 밖).`,
);
findings.push(
  `정부지원금: DB의 transaction_support_details.status CHECK는 영문 enum(planned/eligible/applied/approved/receiving/completed/rejected/expired)인데 원본 "지급여부" 컬럼은 자유 텍스트(주로 "ㅇ" 체크 표시)입니다. 키워드 매칭이 실패한 행은 기본값 'planned'로 채우고 needs_review=true, memo에 원문을 보존했습니다 — 임의로 확정하지 않고 검토 필요로 표시(키워드 매칭 실패 건수: ${supportStatusGuessed}/${output.transaction_support_details.length}).`,
);

// ---------------------------------------------------------------------------------------
// 4. 축의금&부조금 (all years, cumulative) — bespoke block-aware port of parseEventRows
//    (excel-support-event-import.ts). Each year's sheet was found to contain the FULL running
//    history (not just that year), so cross-file dedupe is required, same as Upbit.
// ---------------------------------------------------------------------------------------

function eventTypeOf(value) {
  const v = text(value);
  if (v.includes('축의')) return 'wedding';
  if (v.includes('부조') || v.includes('조의')) return 'condolence';
  if (v.includes('선물')) return 'gift';
  return 'other';
}

// Finds every `날짜|내용|금액` triple (parseEventRows' literal pattern) AND every
// `이름|내용|금액` triple (a second real shape found in this workbook that the existing
// parser's literal '날짜' check would silently miss) at the header row where both '날짜' and
// '내용' appear somewhere (matching parseEventRows' own header-row locator).
function findEventBlocks(rows) {
  const headerIndex = rows.findIndex((row) => row.some((v) => text(v) === '날짜') && row.some((v) => text(v) === '내용'));
  if (headerIndex < 0) return { headerIndex: -1, blocks: [] };
  const header = rows[headerIndex] ?? [];
  const blocks = [];
  for (let start = 0; start < header.length - 2; start += 1) {
    const h0 = text(header[start]);
    const h1 = text(header[start + 1]);
    const h2 = text(header[start + 2]);
    if ((h0 === '날짜' || h0 === '이름') && h1 === '내용' && h2 === '금액') {
      blocks.push({ start, hasDate: h0 === '날짜', titleCol: start });
    }
  }
  return { headerIndex, blocks };
}

let eventOutOfScopeBlocks = 0;
let eventUnmappedNoAmount = 0;
let eventEstimatedDateCount = 0;
const eventSeen = new Map();
let eventDuplicateCount = 0;

function pushEventTransaction({ file, sheetName, rowIndex, direction, description, amount, transactionDate, title, dateEstimated }) {
  const tempId = nextTempId('txn-event');
  const type = direction === 'out' ? eventTypeOf(description) : eventTypeOf(title);
  const summary = `${title} / ${description} / ${amount}원`;
  const txnRow = {
    _tempId: tempId,
    transaction_date: transactionDate,
    source_month: null,
    transaction_type: direction === 'out' ? 'expense' : 'income',
    flow_class: direction === 'out' ? 'consumption' : 'cash_in',
    cost_behavior: direction === 'out' ? 'variable' : null,
    category_id: null,
    subcategory_id: null,
    payment_method_id: null,
    account_id: null,
    amount: Math.abs(amount),
    description,
    memo: dateEstimated ? `[날짜 추정됨, 원문: "${summary}"]` : null,
    include_in_budget: direction === 'out',
    needs_review: Boolean(dateEstimated),
    status: 'posted',
    _category_name: direction === 'out' ? '경조사비' : '경조사수입',
    _subcategory_name: null,
    _payment_method_name: direction === 'out' ? '현금/계좌이체(원본 미기재)' : null,
    _source: source(file, sheetName, rowIndex),
  };
  // Outgoing event money has no explicit payment-method column in this sheet shape; flagged
  // via _payment_method_name placeholder rather than failing the "결제수단 없음" check noisily
  // for every single row — still surfaced as a finding below.
  validateTransaction(txnRow, file, sheetName, rowIndex);
  output.transactions.push(txnRow);
  const detailRow = {
    _transaction_ref: tempId,
    event_type: type,
    counterparty: direction === 'in' ? description : null,
    relationship_group: null,
    event_description: direction === 'out' ? description : title,
    memo: null,
    _source: source(file, sheetName, rowIndex),
  };
  if (!['wedding', 'condolence', 'gift', 'other'].includes(detailRow.event_type)) {
    addError('transaction_event_details', file, sheetName, rowIndex, `event_type CHECK 위반: ${detailRow.event_type}`);
  }
  output.transaction_event_details.push(detailRow);
}

for (let yi = 0; yi < YEARS.length; yi += 1) {
  const file = FILES[yi];
  const sheetName = '축의금&부조금';
  if (!hasSheet(file, sheetName)) continue;
  const rows = sheetRows(file, sheetName);
  const { headerIndex, blocks } = findEventBlocks(rows);
  if (headerIndex < 0) {
    addUnmapped(file, sheetName, null, '날짜/내용 헤더를 찾지 못함', null);
    continue;
  }
  const titleRow = rows[headerIndex - 1] ?? [];
  for (const block of blocks) {
    const title = text(titleRow[block.titleCol]);
    // Section titles that are NOT about congratulatory/condolence money (e.g. "비상금2"/
    // "비상금3" emergency-fund tracking columns found in 2023-2025 sheets sharing this same
    // 날짜|내용|금액 shape) are out of scope for this migration (not mentioned anywhere in the
    // approved migration plan) and are intentionally excluded — logged, not silently dropped.
    const isEventSection = /축의|부조|결혼|부의|조의|경조/.test(title);
    if (!isEventSection) {
      const hasAnyData = rows.slice(headerIndex + 1).some((row) => text(row[block.start + 1]));
      if (hasAnyData) {
        eventOutOfScopeBlocks += 1;
        skippedOutOfScope.push({ file, sheet: sheetName, reason: `"${title || '(제목 없음)'}" 블록(열 ${block.start})은 축의금/부조금 관련이 아닌 것으로 보여(예: 비상금 관리) 이번 마이그레이션 범위에서 제외` });
      }
      continue;
    }
    // Direction: the generic outgoing ledger is always titled literally "축의/부조 내역" or
    // "축의/부의" (no specific person's event named) in every year checked — money the
    // household PAID to attend others' events. Any other title naming a specific event
    // ("...결혼식/축의금내역", "...부조금내역") lists contributors who gave money AT the
    // household's own event — money RECEIVED.
    const isOutgoing = /^축의\s*\/?\s*부[조의]\s*(내역)?$/.test(title.replace(/\s+/g, ''));
    const direction = isOutgoing ? 'out' : 'in';
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const rowIndex = headerIndex + offset + 2;
      if (!block.hasDate) {
        // No date column at all in this block shape ("이름|내용|금액|합계" receiving list). Unlike
        // the 날짜|내용|금액 blocks, the distinguishing per-row value here is the contributor's
        // NAME (row[block.start], header "이름") — row[block.start + 1] ("내용") is a single
        // shared label repeated identically on every row of the block (e.g. "외조모부의금_규남"
        // for every contributor), so using it as `description` would collapse distinct
        // contributors together. The name is used as the transaction description instead, with
        // the shared label folded into the summary/memo for context.
        const contributorName = text(row[block.start]);
        const sharedLabel = text(row[block.start + 1]);
        if (!contributorName) return;
        const amount = signedMoney(row[block.start + 2]);
        const description = sharedLabel ? `${contributorName} (${sharedLabel})` : contributorName;
        // 2026-09-03 user decision: no longer excluded — amount must still be present (cannot be
        // fabricated), but a missing date now gets Jan 1 of the source workbook's year +
        // needs_review=true instead of being dropped. Dedupe key intentionally omits the date
        // (there is no real one to key on) so the same event repeated across cumulative years'
        // sheets still collapses to a single row, using whichever (earliest-processed) year's
        // workbook it first appeared in as the estimate. Keying on the contributor name (not the
        // shared label) is what makes this a correct per-contributor dedupe.
        if (amount === null) {
          eventUnmappedNoAmount += 1;
          addUnmapped(file, sheetName, rowIndex, `"${title}" 항목("${description}")의 금액을 확인하지 못함`, row);
          return;
        }
        const dedupeKey = `nodate|${direction}|${amount}|${description.toLowerCase()}`;
        if (eventSeen.has(dedupeKey)) {
          eventDuplicateCount += 1;
          return;
        }
        eventSeen.set(dedupeKey, true);
        const estimatedDate = `${YEARS[yi]}-01-01`;
        eventEstimatedDateCount += 1;
        addEstimatedDate('transactions(축의금&부조금 받은내역)', file, sheetName, rowIndex, `${title} / ${description}`, estimatedDate);
        pushEventTransaction({ file, sheetName, rowIndex, direction, description, amount, transactionDate: estimatedDate, title, dateEstimated: true });
        return;
      }
      const description = text(row[block.start + 1]);
      if (!description) return;
      const amount = signedMoney(row[block.start + 2]);
      const eventDate = normalizeImportDate(row[block.start]);
      if (!eventDate || amount === null) {
        addUnmapped(file, sheetName, rowIndex, `날짜 또는 금액을 확인하지 못함(날짜=${row[block.start]}, 금액=${row[block.start + 2]})`, row);
        return;
      }
      const dedupeKey = `${eventDate}|${direction}|${amount}|${description.toLowerCase()}`;
      if (eventSeen.has(dedupeKey)) {
        eventDuplicateCount += 1;
        return;
      }
      eventSeen.set(dedupeKey, true);
      pushEventTransaction({ file, sheetName, rowIndex, direction, description, amount, transactionDate: eventDate, title, dateEstimated: false });
    });
  }
}
findings.push(
  `축의금&부조금: 업비트와 마찬가지로 각 연도 워크북의 이 시트가 그 시점까지의 전체 누적 내역을 담고 있어(2024/2025/2026년 파일에 2023-11-16 항목이 동일하게 반복) 연도 파일 간 중복 ${eventDuplicateCount}건을 (날짜|방향|금액|내용) 키로 제거했습니다.`,
);
findings.push(
  `축의금&부조금: 시트에 "이름|내용|금액|합계" 형태의 수령 내역 블록(예: "OOO외조모부조금내역")이 있으나 날짜 컬럼이 전혀 없습니다. 2026-09-03 사용자 승인에 따라, 금액이 확인되는 ${eventEstimatedDateCount}건은 제외하지 않고 해당 워크북 연도의 1월 1일을 transaction_date로 사용하고 needs_review=true, memo에 추정 근거를 남겼습니다 — "추정 날짜로 처리된 항목" 섹션 참고. 금액 자체를 못 읽은 ${eventUnmappedNoAmount}건은 여전히 unmapped로 남습니다(승인 범위 밖).`,
);
if (eventOutOfScopeBlocks > 0) {
  findings.push(`축의금&부조금: "비상금" 등 경조사와 무관한 동일 모양(날짜|내용|금액) 블록 ${eventOutOfScopeBlocks}개는 마이그레이션 계획에 없는 별개 개념이라 제외했습니다(skippedOutOfScope 참고).`);
}
findings.push(
  '축의금&부조금(지출 방향/direction=out) 행에는 원본에 결제수단 컬럼이 없어 payment_method 관련 필드를 확정할 수 없습니다 — _payment_method_name에 안내 문구만 남기고 실제 매핑은 보류합니다.',
);

// ---------------------------------------------------------------------------------------
// 5. Latest-snapshot-only sheets (2026년.xlsm ONLY): 계좌현황, 자산현황, 카드보유현황,
//    예금관리, 적금관리, 대출, 보험
// ---------------------------------------------------------------------------------------

const SNAPSHOT_FILE = '2026년.xlsm';

// Generic multi-block header/body scanner shared by accounts/cards/deposits/savings/insurance.
// Several of these sheets were found (by dumping the real 2026 workbook) to contain more than
// one physically-repeated header block (e.g. a second "노후자금" block in 계좌현황, a second
// "명의자=엄마" block in 카드보유현황) separated by blank rows — scanning only the first
// occurrence (as several of the literal src/lib/excel-*.ts parsers do, since they use
// `rows.findIndex`) would silently drop those rows, so this dry run intentionally scans for
// every matching header row instead.
function findHeaderBlocks(rows, requiredAliasGroups, maxScan = 200) {
  const blocks = [];
  for (let i = 0; i < Math.min(maxScan, rows.length); i += 1) {
    const row = rows[i] ?? [];
    const requiredOk = Object.values(requiredAliasGroups).every((aliases) => findCol(row, aliases) >= 0);
    if (requiredOk) blocks.push(i);
  }
  return blocks;
}

function blockEnd(rows, startAfter, limit) {
  for (let i = startAfter; i < limit; i += 1) {
    if (!rowHasData(rows[i])) return i;
  }
  return limit;
}

function columnsFor(headerRow, aliasMap) {
  const cols = {};
  for (const [key, aliases] of Object.entries(aliasMap)) cols[key] = findCol(headerRow, aliases);
  return cols;
}

// --- 5.1 계좌현황 -> accounts -------------------------------------------------------------
{
  const file = SNAPSHOT_FILE;
  const sheetName = '계좌현황';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    const required = { bank: ['은행', 'bank'], name: ['계좌명', '계좌 이름', 'account name'], balance: ['현재금액', '현재 잔액', '잔액', 'balance'] };
    const optional = { type: ['종류', '유형', 'type'], number: ['계좌번호', 'account number'], purpose: ['용도', 'purpose'], memo: ['비고', '메모', 'memo'] };
    const headerRows = findHeaderBlocks(rows, required);
    if (headerRows.length === 0) addUnmapped(file, sheetName, null, '계좌현황 헤더(은행/계좌명/현재금액)를 찾지 못함', null);
    headerRows.forEach((headerRow, blockIdx) => {
      const cols = { ...columnsFor(rows[headerRow], required), ...columnsFor(rows[headerRow], optional) };
      const nextHeader = headerRows[blockIdx + 1] ?? rows.length;
      const end = blockEnd(rows, headerRow + 1, nextHeader);
      for (let i = headerRow + 1; i < end; i += 1) {
        const row = rows[i] ?? [];
        if (!rowHasData(row)) continue;
        const bankName = text(row[cols.bank]);
        const accountName = text(row[cols.name]);
        const balance = signedMoney(row[cols.balance]);
        const memoRaw = cols.memo >= 0 ? text(row[cols.memo]) || null : null;
        if (!bankName && !accountName && balance === null) continue;
        const rowIndex = i + 1;
        if (!bankName || !accountName || balance === null) {
          addUnmapped(file, sheetName, rowIndex, '계좌 필수값(은행/계좌명/현재금액) 중 일부 누락', row);
          continue;
        }
        const typeText = normKey(cols.type >= 0 ? row[cols.type] : '');
        const accountType = typeText.includes('저축') || typeText.includes('적금') ? 'savings' : typeText.includes('cma') ? 'cma' : typeText.includes('입출금') || typeText.includes('보통') || typeText.includes('checking') ? 'checking' : 'other';
        const dbRow = {
          bank_name: bankName,
          account_type: accountType,
          account_name: accountName,
          account_number: cols.number >= 0 ? text(row[cols.number]) || null : null,
          purpose: cols.purpose >= 0 ? text(row[cols.purpose]) || null : null,
          current_balance: balance,
          // NOTE: this sheet's "비고" column actually holds the account holder's name
          // (정미/규남/하진/서진), not a free-text note — accounts has no holder_name column
          // (unlike cards, which got one added for this exact reason; see migration-plan §2.1).
          // Preserved as-is in memo per doc principle "명의자는 데이터 속성으로 보존".
          memo: memoRaw,
          status: 'active',
          _source: source(file, sheetName, rowIndex),
        };
        if (!['checking', 'savings', 'cma', 'other'].includes(dbRow.account_type)) addError('accounts', file, sheetName, rowIndex, `account_type CHECK 위반: ${dbRow.account_type}`);
        output.accounts.push(dbRow);
      }
    });
  }
  findings.push('계좌현황: "비고" 컬럼이 실제로는 계좌 명의자명(정미/규남/하진/서진)을 담고 있습니다. accounts 테이블에는 명의자 전용 컬럼이 없어(카드처럼 스키마 변경이 승인되지 않았으므로) memo 그대로 보존했습니다.');
}

// --- 5.2 자산현황 -> assets ----------------------------------------------------------------
{
  const file = SNAPSHOT_FILE;
  const sheetName = '자산현황';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    // The literal parseAssetRows alias set (자산명/자산 + 현재가/현재금액/평가액) matches
    // NOTHING in the real 자산현황 sheet — it is a dashboard (금융자산 총계/부동자산 총계/
    // 부채/순자산/저축계획/월별 추이), not a flat asset list. The only genuinely standalone,
    // not-otherwise-represented assets are under the "부동자산" (real estate/car) section,
    // which uses "내용"/"금액" headers instead. This is a deliberate, documented deviation
    // from a literal parser port (a literal port would silently return zero rows).
    const sectionTitleIndex = rows.findIndex((row) => row.some((v) => text(v) === '부동자산'));
    if (sectionTitleIndex < 0) {
      addUnmapped(file, sheetName, null, '"부동자산" 섹션을 찾지 못함 — parseAssetRows의 자산명/현재가 별칭이 이 시트 구조와 전혀 맞지 않음', null);
    } else {
      const headerIdx = sectionTitleIndex + 1;
      const header = rows[headerIdx] ?? [];
      const nameCol = findCol(header, ['내용']);
      const amountCol = findCol(header, ['금액']);
      if (nameCol < 0 || amountCol < 0) {
        addUnmapped(file, sheetName, headerIdx + 1, '"부동자산" 섹션 하위 헤더(No./내용/금액)를 찾지 못함', header);
      } else {
        for (let i = headerIdx + 1; i < rows.length; i += 1) {
          const row = rows[i] ?? [];
          const name = text(row[nameCol]);
          if (!name) break; // stop at first blank / "계" total row boundary
          if (name === '계') break;
          const currentValue = signedMoney(row[amountCol]);
          const rowIndex = i + 1;
          if (currentValue === null) {
            addUnmapped(file, sheetName, rowIndex, `자산 "${name}"의 금액을 확인하지 못함`, row);
            continue;
          }
          const typeText = normKey(name);
          const assetType = typeText.includes('아파트') || typeText.includes('부동산') || typeText.includes('주택') ? 'real_estate' : typeText.includes('자동차') || typeText.includes('차량') ? 'car' : typeText.includes('금') || typeText.includes('귀금속') ? 'precious_metal' : 'other';
          const dbRow = {
            asset_name: name,
            asset_type: assetType,
            acquisition_cost: currentValue >= 0 ? currentValue : 0,
            current_value: currentValue,
            // No date column exists anywhere in this section — flagged below rather than guessed.
            valuation_date: null,
            memo: null,
            status: 'active',
            _source: source(file, sheetName, rowIndex),
          };
          if (dbRow.valuation_date === null) addError('assets', file, sheetName, rowIndex, 'valuation_date NOT NULL 위반 — 원본 시트에 평가일 컬럼이 없어 값을 만들지 못함(임의 날짜를 넣지 않음)');
          if (!['real_estate', 'car', 'precious_metal', 'other'].includes(dbRow.asset_type)) addError('assets', file, sheetName, rowIndex, `asset_type CHECK 위반: ${dbRow.asset_type}`);
          if (!(dbRow.current_value >= 0)) addError('assets', file, sheetName, rowIndex, `current_value >= 0 위반: ${dbRow.current_value}`);
          output.assets.push(dbRow);
        }
      }
    }
  }
  findings.push(
    '자산현황: parseAssetRows의 헤더 별칭("자산명"/"현재가"/"현재금액"/"평가액")이 실제 시트("부동자산" 섹션의 "내용"/"금액" 헤더, 그 외는 금융자산 집계 대시보드)와 전혀 일치하지 않아 그대로 포팅하면 0건이 됩니다. "부동자산" 섹션만 자산으로 매핑했고(풍림아파트/귤밍자동차 — 예금/적금/계좌현황과 중복되지 않는 유일한 실물자산), 평가일(valuation_date) 컬럼이 없어 NOT NULL 위반을 validation error로 명시했습니다. "금융자산" 섹션(장기/중기/단기 집계)은 예금·적금·계좌현황과 중복 집계이므로 가져오지 않았습니다.',
  );
}

// --- 5.3 카드보유현황 -> cards (2025+ only, so read from 2026년.xlsm per instructions) -----
{
  const file = SNAPSHOT_FILE;
  const sheetName = '카드보유현황';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    // Bespoke header set per migration-plan.md §2 point 4: 구분 -> issuer (NOT 발급처).
    const required = { issuer: ['구분'], name: ['카드명'] };
    const optional = { type: ['유형'], issuedBy: ['발급처'], fee: ['연회비'], cancel: ['해지가능월', '해지일'], benefit: ['실질혜택', '혜택'], holder: ['명의자'], memo: ['비고', '메모'] };
    const headerRows = findHeaderBlocks(rows, required);
    if (headerRows.length === 0) addUnmapped(file, sheetName, null, '카드보유현황 헤더(구분/카드명)를 찾지 못함', null);
    headerRows.forEach((headerRow, blockIdx) => {
      const cols = { ...columnsFor(rows[headerRow], required), ...columnsFor(rows[headerRow], optional) };
      const nextHeader = headerRows[blockIdx + 1] ?? rows.length;
      const end = blockEnd(rows, headerRow + 1, nextHeader);
      for (let i = headerRow + 1; i < end; i += 1) {
        const row = rows[i] ?? [];
        if (!rowHasData(row)) continue;
        const issuer = text(row[cols.issuer]);
        const cardName = text(row[cols.name]);
        const rowIndex = i + 1;
        if (!issuer || !cardName) {
          addUnmapped(file, sheetName, rowIndex, '카드 필수값(구분/카드명) 중 일부 누락', row);
          continue;
        }
        const annualFeeRaw = cols.fee >= 0 ? row[cols.fee] : null;
        const annualFee = signedMoney(annualFeeRaw) ?? 0; // "-" / blank => treated as 0 (no fee), matching schema default.
        const issuedByText = cols.issuedBy >= 0 ? text(row[cols.issuedBy]) : '';
        const memoBase = cols.memo >= 0 ? text(row[cols.memo]) : '';
        // cards has no `issued_by` column (dropped in 20260907000000_remove_member_attribution.sql)
        // so the "발급처" affiliate-channel text (e.g. "카카오페이") is preserved in memo instead
        // of being dropped.
        const memoParts = [];
        if (issuedByText && issuedByText !== '-') memoParts.push(`발급처:${issuedByText}`);
        if (memoBase) memoParts.push(memoBase);
        const typeText = normKey(cols.type >= 0 ? row[cols.type] : '');
        const dbRow = {
          issuer,
          card_type: typeText.includes('체크') ? 'check' : 'credit',
          card_name: cardName,
          annual_fee: annualFee,
          cancellable_from: null, // source is free text ("25.12.03 발급" etc.), not a clean date — see finding below.
          benefit_summary: cols.benefit >= 0 ? text(row[cols.benefit]) || null : null,
          holder_name: cols.holder >= 0 ? text(row[cols.holder]) || null : null,
          memo: memoParts.join(' / ') || null,
          status: 'active',
          _cancellable_from_raw: cols.cancel >= 0 ? text(row[cols.cancel]) || null : null,
          _source: source(file, sheetName, rowIndex),
        };
        if (!['credit', 'check'].includes(dbRow.card_type)) addError('cards', file, sheetName, rowIndex, `card_type CHECK 위반: ${dbRow.card_type}`);
        if (!(dbRow.annual_fee >= 0)) addError('cards', file, sheetName, rowIndex, `annual_fee >= 0 위반: ${dbRow.annual_fee}`);
        output.cards.push(dbRow);
      }
    });
  }
  findings.push(
    '카드보유현황: 2026년 시트는 헤더 블록이 두 번(정미/규남 그룹, 이후 엄마 그룹) 반복되어 있어 첫 블록만 찾는 기존 parseCardRows(rows.findIndex) 방식으로는 두 번째 블록이 통째로 누락됩니다. 이 드라이런은 모든 헤더 블록을 스캔해 두 블록 모두 포함했습니다.',
  );
  findings.push(
    '카드보유현황: "해지가능월/해지일" 컬럼 값이 "25.12.03", "26.06.05", "25.12.22 발급", "이벤트지급받고 즉시" 등 형식이 섞여 있어 일괄적으로 date로 파싱하면 다수가 틀리거나 null이 됩니다. 이 드라이런은 cancellable_from을 null로 두고 원문을 _cancellable_from_raw에 보존했습니다 — 실제 마이그레이션 시 수기 검토 필요.',
  );
  findings.push('카드보유현황: cards 테이블에 issued_by 컬럼이 없어(2025-09-07 삭제) "발급처"(카카오페이 등 제휴채널) 값은 memo에 "발급처:xxx"로 보존했습니다.');
}

// --- 5.4 예금관리 -> deposits ---------------------------------------------------------------
{
  const file = SNAPSHOT_FILE;
  const sheetName = '예금관리';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    const required = { bank: ['은행', 'bank'], product: ['예금명', '상품명', 'product'], joined: ['가입일', '가입일자'], maturity: ['만기일', '만기'], principal: ['원금', '예치금액'], rateCol: ['이율', '금리'] };
    const optional = { tax: ['과세', '세율'], memo: ['비고', '메모'] };
    const headerRows = findHeaderBlocks(rows, required);
    if (headerRows.length === 0) addUnmapped(file, sheetName, null, '예금관리 헤더를 찾지 못함', null);
    headerRows.forEach((headerRow, blockIdx) => {
      const cols = { ...columnsFor(rows[headerRow], required), ...columnsFor(rows[headerRow], optional) };
      const nextHeader = headerRows[blockIdx + 1] ?? rows.length;
      const end = blockEnd(rows, headerRow + 1, nextHeader);
      for (let i = headerRow + 1; i < end; i += 1) {
        const row = rows[i] ?? [];
        if (!rowHasData(row)) continue;
        const bankName = text(row[cols.bank]);
        const rowIndex = i + 1;
        if (!bankName) {
          if (text(row[cols.product])) addUnmapped(file, sheetName, rowIndex, '예금 은행명 누락(다른 필드는 존재)', row);
          continue;
        }
        const productName = text(row[cols.product]);
        const joinedAt = normalizeImportDate(row[cols.joined]);
        const maturityDate = normalizeImportDate(row[cols.maturity]);
        const principal = signedMoney(row[cols.principal]);
        const annualRate = rate(row[cols.rateCol]);
        const taxRate = rate(row[cols.tax]) ?? 0.154;
        if (!productName || !joinedAt || !maturityDate || principal === null || annualRate === null) {
          addUnmapped(file, sheetName, rowIndex, '예금 필수값(상품명/가입일/만기일/원금/이율) 중 일부 누락', row);
          continue;
        }
        const dbRow = {
          bank_name: bankName,
          product_name: productName,
          joined_at: joinedAt,
          maturity_date: maturityDate,
          principal,
          annual_rate: annualRate,
          tax_rate: taxRate,
          memo: cols.memo >= 0 ? text(row[cols.memo]) || null : null,
          status: 'active',
          _source: source(file, sheetName, rowIndex),
        };
        if (!(dbRow.principal > 0)) addError('deposits', file, sheetName, rowIndex, `principal > 0 위반: ${dbRow.principal}`);
        if (!(dbRow.annual_rate >= 0 && dbRow.annual_rate <= 1)) addError('deposits', file, sheetName, rowIndex, `annual_rate 0..1 위반: ${dbRow.annual_rate}`);
        if (!(dbRow.tax_rate >= 0 && dbRow.tax_rate <= 1)) addError('deposits', file, sheetName, rowIndex, `tax_rate 0..1 위반: ${dbRow.tax_rate}`);
        if (!(dbRow.maturity_date >= dbRow.joined_at)) addError('deposits', file, sheetName, rowIndex, `maturity_date >= joined_at 위반: ${dbRow.maturity_date} < ${dbRow.joined_at}`);
        output.deposits.push(dbRow);
      }
    });
  }
}

// --- 5.5 적금관리 -> savings_accounts --------------------------------------------------------
{
  const file = SNAPSHOT_FILE;
  const sheetName = '적금관리';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    const required = { bank: ['은행', 'bank'], product: ['적금명', '상품명', 'product'], joined: ['가입일', '가입일자'], maturity: ['만기일', '만기'], monthly: ['월 적립액', '월적립액', '월납입액'], rateCol: ['이율', '금리'] };
    const optional = { tax: ['과세', '세율'], current: ['현재저축액', '현재 저축액', '현재금액'], method: ['방식'], memo: ['비고', '메모'] };
    const headerRows = findHeaderBlocks(rows, required);
    if (headerRows.length === 0) addUnmapped(file, sheetName, null, '적금관리 헤더를 찾지 못함', null);
    let methodUnmatched = 0;
    headerRows.forEach((headerRow, blockIdx) => {
      const cols = { ...columnsFor(rows[headerRow], required), ...columnsFor(rows[headerRow], optional) };
      const nextHeader = headerRows[blockIdx + 1] ?? rows.length;
      const end = blockEnd(rows, headerRow + 1, nextHeader);
      for (let i = headerRow + 1; i < end; i += 1) {
        const row = rows[i] ?? [];
        if (!rowHasData(row)) continue;
        const bankName = text(row[cols.bank]);
        const rowIndex = i + 1;
        if (!bankName) {
          if (text(row[cols.product])) addUnmapped(file, sheetName, rowIndex, '적금 은행명 누락(다른 필드는 존재)', row);
          continue;
        }
        const productName = text(row[cols.product]);
        const joinedAt = normalizeImportDate(row[cols.joined]);
        const maturityDate = normalizeImportDate(row[cols.maturity]);
        const monthlyAmount = signedMoney(row[cols.monthly]);
        const annualRate = rate(row[cols.rateCol]);
        const taxRate = rate(row[cols.tax]) ?? 0.154;
        const currentSavings = cols.current >= 0 ? signedMoney(row[cols.current]) : null;
        if (!productName || !joinedAt || !maturityDate || monthlyAmount === null || currentSavings === null) {
          addUnmapped(file, sheetName, rowIndex, '적금 필수값(상품명/가입일/만기일/월적립액/현재저축액) 중 일부 누락', row);
          continue;
        }
        const methodText = cols.method >= 0 ? text(row[cols.method]) : '';
        let interestMethod = 'simple';
        if (methodText.includes('월복리') || methodText.includes('복리')) interestMethod = 'monthly_compound';
        else if (methodText.includes('단리')) interestMethod = 'simple';
        else if (methodText) methodUnmatched += 1;
        const dbRow = {
          bank_name: bankName,
          product_name: productName,
          joined_at: joinedAt,
          maturity_date: maturityDate,
          monthly_amount: monthlyAmount,
          annual_rate: annualRate ?? 0,
          tax_rate: taxRate,
          interest_method: interestMethod,
          current_savings: currentSavings,
          memo: cols.memo >= 0 ? text(row[cols.memo]) || null : null,
          status: 'active',
          _interest_method_raw: methodText || null,
          _source: source(file, sheetName, rowIndex),
        };
        if (!(dbRow.monthly_amount > 0)) addError('savings_accounts', file, sheetName, rowIndex, `monthly_amount > 0 위반: ${dbRow.monthly_amount}`);
        if (annualRate === null) addError('savings_accounts', file, sheetName, rowIndex, '이율을 확인하지 못함(annual_rate NOT NULL)');
        if (!(dbRow.annual_rate >= 0 && dbRow.annual_rate <= 1)) addError('savings_accounts', file, sheetName, rowIndex, `annual_rate 0..1 위반: ${dbRow.annual_rate}`);
        if (!(dbRow.tax_rate >= 0 && dbRow.tax_rate <= 1)) addError('savings_accounts', file, sheetName, rowIndex, `tax_rate 0..1 위반: ${dbRow.tax_rate}`);
        if (!(dbRow.current_savings >= 0)) addError('savings_accounts', file, sheetName, rowIndex, `current_savings >= 0 위반: ${dbRow.current_savings}`);
        if (!['simple', 'monthly_compound'].includes(dbRow.interest_method)) addError('savings_accounts', file, sheetName, rowIndex, `interest_method CHECK 위반: ${dbRow.interest_method}`);
        if (!(dbRow.maturity_date >= dbRow.joined_at)) addError('savings_accounts', file, sheetName, rowIndex, `maturity_date >= joined_at 위반`);
        output.savings_accounts.push(dbRow);
      }
    });
    if (methodUnmatched > 0) findings.push(`적금관리: "방식" 컬럼 값이 "단리"/"월복리" 키워드와 매치되지 않은 행 ${methodUnmatched}건은 기본값 'simple'로 두었습니다(원문은 _interest_method_raw에 보존).`);
  }
  findings.push('적금관리: parseSavingsRows는 "방식"(단리/월복리) 컬럼을 전혀 읽지 않지만 savings_accounts.interest_method는 NOT NULL이라, 대출 상환방법과 동일한 원칙으로 실제 "방식" 컬럼을 직접 읽어 매핑했습니다(단리→simple, 월복리→monthly_compound).');
}

// --- 5.6 보험 -> insurances ------------------------------------------------------------------
{
  const file = SNAPSHOT_FILE;
  const sheetName = '보험';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    const names = { insurer: ['보험사'], type: ['종류'], product: ['보험명'], coverage: ['보장내역'], payment: ['납부방법'], joined: ['가입일'], paymentMaturity: ['납입만기'], coverageMaturity: ['보험만기'], premium: ['월보험료'] };
    let headerIndex = -1;
    let cols = null;
    for (let i = 0; i < Math.min(rows.length, 50); i += 1) {
      const candidate = columnsFor(rows[i] ?? [], names);
      if (Object.values(candidate).every((v) => v >= 0)) {
        headerIndex = i;
        cols = candidate;
        break;
      }
    }
    if (headerIndex < 0) {
      addUnmapped(file, sheetName, null, '보험 헤더(보험사/종류/보험명/보장내역/납부방법/가입일/납입만기/보험만기/월보험료 전부)를 찾지 못함', null);
    } else {
      const noCol = findCol(rows[headerIndex] ?? [], ['No.', 'No', '번호']);
      let skippedBlankProduct = 0;
      for (let i = headerIndex + 1; i < rows.length; i += 1) {
        const row = rows[i] ?? [];
        if (!rowHasData(row)) continue;
        const rowIndex = i + 1;
        const insurerName = text(row[cols.insurer]);
        const productName = text(row[cols.product]);
        if (!insurerName) {
          if (productName) {
            skippedBlankProduct += 1;
            addUnmapped(file, sheetName, rowIndex, `보험명 "${productName}"이 있지만 보험사가 비어 있어 매핑 불가(원문 그대로 보존)`, row);
          }
          continue;
        }
        const joinedAt = normalizeImportDate(row[cols.joined]);
        const monthlyPremium = signedMoney(row[cols.premium]) ?? 0;
        const insuranceType = text(row[cols.type]);
        if (!productName || !insuranceType || !joinedAt) {
          addUnmapped(file, sheetName, rowIndex, '보험 필수값(보험명/종류/가입일) 중 일부 누락', row);
          continue;
        }
        const isTerminated = noCol >= 0 && text(row[noCol]) === '해지';
        const dbRow = {
          insurer_name: insurerName,
          insurance_type: insuranceType,
          product_name: productName,
          coverage_summary: text(row[cols.coverage]) || null,
          payment_method_note: text(row[cols.payment]) || null,
          joined_at: joinedAt,
          payment_maturity_date: normalizeImportDate(row[cols.paymentMaturity]),
          coverage_maturity_date: normalizeImportDate(row[cols.coverageMaturity]),
          monthly_premium: monthlyPremium,
          // 피보험자(insured person name) has no destination column — insurances.insured_member_id
          // was dropped in 20260907000000_remove_member_attribution.sql along with every other
          // *_member_id column. Preserved as plain text in memo instead of being dropped.
          memo: `피보험자:${text(row[cols.insurer - 1] ?? '')}`.trim(),
          status: isTerminated ? 'terminated' : 'active',
          ended_at: null, // status=terminated rows have no explicit end date column in this sheet.
          _source: source(file, sheetName, rowIndex),
        };
        if (!(dbRow.monthly_premium >= 0)) addError('insurances', file, sheetName, rowIndex, `monthly_premium >= 0 위반: ${dbRow.monthly_premium}`);
        if (!['active', 'terminated', 'free'].includes(dbRow.status)) addError('insurances', file, sheetName, rowIndex, `status CHECK 위반: ${dbRow.status}`);
        output.insurances.push(dbRow);
      }
      if (skippedBlankProduct > 0) findings.push(`보험: 보험사/종류/가입일이 비어 있지만 보험명은 존재하는 행(예: "꾸미" 명의 실손/종합건강보험) ${skippedBlankProduct}건은 자동 매핑하지 못해 unmapped로 남겼습니다 — 수기 확인 필요.`);
    }
  }
  findings.push('보험: 피보험자(규남/정미/하진/꾸미 등) 컬럼은 insurances.insured_member_id가 삭제되어 저장할 FK가 없으므로 memo에 "피보험자:이름"으로 보존했습니다.');
  findings.push('보험: "해지" 상태 행은 시트에 종료일 컬럼이 없어 ended_at을 null로 두었습니다(status<>active일 때 ended_at은 NULL 허용이라 CHECK 위반은 아니지만, 실제 종료일 정보가 없다는 한계를 명시).');
}

// ---------------------------------------------------------------------------------------
// 6. 대출 (2026 snapshot, status='active') and 대환_상환완료건 (2025+2026, dedupe, status
//    derived from whether the final schedule row's remaining balance is 0)
// ---------------------------------------------------------------------------------------

function mapRepaymentMethod(raw) {
  const t = text(raw);
  if (!t) return { method: null, note: null };
  if (t.includes('원리금균등') || t.includes('원리금체증식')) return { method: 'equal_payment', note: t };
  if (t.includes('원금균등')) return { method: 'equal_principal', note: t };
  if (t.includes('만기일시') || t.includes('만기')) return { method: 'bullet', note: t };
  return { method: null, note: t };
}

// Parses one 대출-shaped sheet: a master row block (기관명/대출명/대출금액/연이자율/상환방법/
// 대출일/상환만기일) followed by a payment-schedule block (회차/상환일/납입원금/대출이자/
// 월상환금/누적상환금/대출잔금/비고). Mirrors parseLoanRows' `locate` header search, except
// 상환방법 is read directly from its own real column instead of guessed from loan/institution
// name text (migration-plan.md §2 point 2).
function parseLoanSheet(rows) {
  const masterNames = { institution: ['기관명', '금융기관'], name: ['대출명'], amount: ['대출금액'], rateCol: ['연이자율', '금리'], method: ['상환방법'], loanDate: ['대출일'], maturity: ['상환만기일', '만기일'] };
  let masterIndex = -1;
  let masterCols = null;
  for (let i = 0; i < Math.min(rows.length, 50); i += 1) {
    const candidate = columnsFor(rows[i] ?? [], masterNames);
    if (Object.values(candidate).every((v) => v >= 0)) {
      masterIndex = i;
      masterCols = candidate;
      break;
    }
  }
  if (masterIndex < 0) return { loans: [], scheduleIndex: -1 };

  const scheduleNames = { installment: ['회차'], paymentDate: ['상환일'], principal: ['납입원금'], interest: ['대출이자'] };
  let scheduleIndex = -1;
  let scheduleCols = null;
  for (let i = masterIndex + 1; i < Math.min(rows.length, masterIndex + 20); i += 1) {
    const candidate = columnsFor(rows[i] ?? [], scheduleNames);
    if (Object.values(candidate).every((v) => v >= 0)) {
      scheduleIndex = i;
      scheduleCols = candidate;
      break;
    }
  }
  const scheduleHeader = scheduleIndex >= 0 ? rows[scheduleIndex] ?? [] : [];
  const totalCol = findCol(scheduleHeader, ['월상환금']);
  const cumulativeCol = findCol(scheduleHeader, ['누적상환금']);
  const remainingCol = findCol(scheduleHeader, ['대출잔금']);
  const memoCol = findCol(scheduleHeader, ['비고']);

  const payments = [];
  if (scheduleIndex >= 0) {
    for (let i = scheduleIndex + 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const installment = Number(row[scheduleCols.installment]);
      const paymentDate = normalizeImportDate(row[scheduleCols.paymentDate]);
      const principalPayment = signedMoney(row[scheduleCols.principal]) ?? -1;
      const interestPayment = signedMoney(row[scheduleCols.interest]) ?? -1;
      const totalPayment = (totalCol >= 0 ? signedMoney(row[totalCol]) : null) ?? principalPayment + interestPayment;
      const cumulativePayment = (cumulativeCol >= 0 ? signedMoney(row[cumulativeCol]) : null) ?? totalPayment;
      const remainingBalance = (remainingCol >= 0 ? signedMoney(row[remainingCol]) : null) ?? 0;
      if (!Number.isSafeInteger(installment) || installment <= 0 || !paymentDate || principalPayment < 0 || interestPayment < 0 || totalPayment < 0 || cumulativePayment < 0 || remainingBalance < 0) continue;
      const memo = memoCol >= 0 ? text(row[memoCol]) || null : null;
      payments.push({ rowIndex: i + 1, installment, paymentDate, principalPayment, interestPayment, totalPayment, cumulativePayment, remainingBalance, memo });
    }
  }
  const firstPaymentDate = payments.length > 0 ? payments[0].paymentDate : null;

  const loanRows = [];
  const masterEnd = scheduleIndex >= 0 ? scheduleIndex : rows.length;
  for (let i = masterIndex + 1; i < masterEnd; i += 1) {
    const row = rows[i] ?? [];
    if (!rowHasData(row)) continue;
    const institutionName = text(row[masterCols.institution]);
    if (!institutionName) continue;
    const originalAmount = signedMoney(row[masterCols.amount]);
    const loanDate = normalizeImportDate(row[masterCols.loanDate]);
    // Deviation from a literal parseLoanRows port: the real sheets place a
    // "상환기간(개월)/남은기간(개월)/거치기간(개월)/..." stats row immediately after the
    // master row and before the schedule header (see dump of 대출/대환_상환완료건). That row
    // has non-blank institution/name-column text and a real numeric 0 in the amount column
    // (거치기간=0 grace months), so the literal `originalAmount === null && loanDate === null`
    // guard (which only catches the case where amount parsing itself failed) does NOT skip
    // it — it would otherwise be mis-parsed as a bogus "loan" named after the stats labels.
    // Requiring a genuinely positive amount AND a resolvable loan date closes that gap.
    if (!(originalAmount > 0) || !loanDate) continue;
    const loanName = text(row[masterCols.name]);
    const annualRate = percent(row[masterCols.rateCol]);
    const maturityDate = normalizeImportDate(row[masterCols.maturity]);
    const repaymentRaw = row[masterCols.method];
    const { method, note } = mapRepaymentMethod(repaymentRaw);
    loanRows.push({ rowIndex: i + 1, institutionName, loanName, originalAmount, annualRate, repaymentMethod: method, repaymentMethodRaw: note, loanDate, firstPaymentDate, maturityDate });
  }
  return { loans: loanRows, payments, firstPaymentDate };
}

function validateLoanRow(dbRow, file, sheet, rowIndex) {
  if (!dbRow.repayment_method || !['equal_payment', 'equal_principal', 'bullet'].includes(dbRow.repayment_method)) {
    addError('loans', file, sheet, rowIndex, `repayment_method을 "${dbRow._repayment_method_raw}"에서 확정하지 못함(equal_payment/equal_principal/bullet 중 하나가 아님)`);
  }
  if (!(dbRow.original_amount > 0)) addError('loans', file, sheet, rowIndex, `original_amount > 0 위반: ${dbRow.original_amount}`);
  if (!(dbRow.annual_rate >= 0 && dbRow.annual_rate <= 1)) addError('loans', file, sheet, rowIndex, `annual_rate 0..1 위반: ${dbRow.annual_rate}`);
  if (!dbRow.first_payment_date || !(dbRow.first_payment_date >= dbRow.loan_date)) addError('loans', file, sheet, rowIndex, `first_payment_date >= loan_date 위반`);
  if (!dbRow.maturity_date || !(dbRow.maturity_date >= dbRow.first_payment_date)) addError('loans', file, sheet, rowIndex, `maturity_date >= first_payment_date 위반`);
  if (!['active', 'paid_off', 'refinanced'].includes(dbRow.status)) addError('loans', file, sheet, rowIndex, `status CHECK 위반: ${dbRow.status}`);
  if (dbRow.status === 'active' && dbRow.ended_at !== null) addError('loans', file, sheet, rowIndex, 'status=active인데 ended_at이 채워짐');
  if (dbRow.status !== 'active' && dbRow.ended_at === null) addError('loans', file, sheet, rowIndex, 'status<>active인데 ended_at이 비어 있음');
}

function paymentTypeFor(memo, status, remainingBalance) {
  if ((memo && memo.includes('대환')) || status === 'refinanced') return 'refinance';
  if (memo && memo.includes('조기')) return 'early';
  if (status === 'paid_off' && remainingBalance === 0) return 'payoff';
  return 'scheduled';
}

function pushLoanPayments(payments, loanTempId, status, file, sheet) {
  for (const p of payments) {
    const paymentType = paymentTypeFor(p.memo, status, p.remainingBalance);
    const dbRow = {
      _loan_ref: loanTempId,
      installment: p.installment,
      payment_date: p.paymentDate,
      principal_payment: p.principalPayment,
      interest_payment: p.interestPayment,
      total_payment: p.totalPayment,
      cumulative_payment: p.cumulativePayment,
      remaining_balance: p.remainingBalance,
      payment_type: paymentType,
      memo: p.memo,
      _source: source(file, sheet, p.rowIndex),
    };
    if (dbRow.total_payment !== dbRow.principal_payment + dbRow.interest_payment) {
      addError('loan_payments', file, sheet, p.rowIndex, `total_payment = principal_payment + interest_payment 위반 (${dbRow.total_payment} != ${dbRow.principal_payment}+${dbRow.interest_payment})`);
    }
    if (!['scheduled', 'early', 'refinance', 'payoff'].includes(dbRow.payment_type)) addError('loan_payments', file, sheet, p.rowIndex, `payment_type CHECK 위반: ${dbRow.payment_type}`);
    output.loan_payments.push(dbRow);
  }
}

// --- 6.1 대출 (active loan snapshot, 2026) ---------------------------------------------------
{
  const file = SNAPSHOT_FILE;
  const sheetName = '대출';
  const rows = sheetRows(file, sheetName);
  if (!rows) {
    addUnmapped(file, sheetName, null, '시트를 찾을 수 없음', null);
  } else {
    const { loans, payments } = parseLoanSheet(rows);
    if (loans.length === 0) addUnmapped(file, sheetName, null, '대출 마스터 행을 찾지 못함', null);
    for (const l of loans) {
      const loanTempId = nextTempId('loan');
      const dbRow = {
        _tempId: loanTempId,
        institution_name: l.institutionName,
        loan_name: l.loanName || l.institutionName,
        original_amount: l.originalAmount,
        annual_rate: l.annualRate,
        repayment_method: l.repaymentMethod,
        loan_date: l.loanDate,
        first_payment_date: l.firstPaymentDate,
        maturity_date: l.maturityDate,
        status: 'active',
        ended_at: null,
        memo: `원문 상환방법: ${l.repaymentMethodRaw ?? '(없음)'}`,
        _repayment_method_raw: l.repaymentMethodRaw,
        _source: source(file, sheetName, l.rowIndex),
      };
      validateLoanRow(dbRow, file, sheetName, l.rowIndex);
      output.loans.push(dbRow);
      pushLoanPayments(payments, loanTempId, 'active', file, sheetName);
    }
  }
}

// --- 6.2 대환_상환완료건 (2025+2026, dedupe by institution_name|loan_name|loan_date|original_amount,
//    prefer the highest available year's version; status derived from final remaining balance) ----
{
  const refinancedLoans = new Map(); // key -> { data, fromYear }
  for (let yi = 0; yi < YEARS.length; yi += 1) {
    const file = FILES[yi];
    const sheetName = '대환_상환완료건';
    if (!hasSheet(file, sheetName)) continue;
    const rows = sheetRows(file, sheetName);
    const { loans, payments } = parseLoanSheet(rows);
    for (const l of loans) {
      const key = `${l.institutionName}|${l.loanName}|${l.loanDate}|${l.originalAmount}`;
      const finalPayment = payments.length > 0 ? payments[payments.length - 1] : null;
      const status = finalPayment && finalPayment.remainingBalance === 0 ? 'paid_off' : 'refinanced';
      const endedAt = finalPayment ? finalPayment.paymentDate : l.maturityDate;
      const existing = refinancedLoans.get(key);
      if (existing && existing.fromYear >= YEARS[yi]) continue; // keep newest year's version
      refinancedLoans.set(key, { file, sheetName, l, payments, status, endedAt, fromYear: YEARS[yi] });
    }
  }
  let dedupedAwayCount = 0;
  for (let yi = 0; yi < YEARS.length; yi += 1) {
    const file = FILES[yi];
    if (!hasSheet(file, '대환_상환완료건')) continue;
    const rows = sheetRows(file, '대환_상환완료건');
    const { loans } = parseLoanSheet(rows);
    for (const l of loans) {
      const key = `${l.institutionName}|${l.loanName}|${l.loanDate}|${l.originalAmount}`;
      const kept = refinancedLoans.get(key);
      if (kept.fromYear !== YEARS[yi]) dedupedAwayCount += 1;
    }
  }
  for (const { file, sheetName, l, payments, status, endedAt } of refinancedLoans.values()) {
    const loanTempId = nextTempId('loan-refi');
    const dbRow = {
      _tempId: loanTempId,
      institution_name: l.institutionName,
      loan_name: l.loanName || l.institutionName,
      original_amount: l.originalAmount,
      annual_rate: l.annualRate,
      repayment_method: l.repaymentMethod,
      loan_date: l.loanDate,
      first_payment_date: l.firstPaymentDate,
      maturity_date: l.maturityDate,
      status,
      ended_at: endedAt,
      memo: `원문 상환방법: ${l.repaymentMethodRaw ?? '(없음)'} / 대환_상환완료건 시트 출처`,
      _repayment_method_raw: l.repaymentMethodRaw,
      _source: source(file, sheetName, l.rowIndex),
    };
    validateLoanRow(dbRow, file, sheetName, l.rowIndex);
    output.loans.push(dbRow);
    pushLoanPayments(payments, loanTempId, status, file, sheetName);
  }
  findings.push(
    `대환_상환완료건: 2025년/2026년 워크북에 동일한 대출(기관명|대출명|대출일|대출금액 기준)이 중복 등장하여 ${dedupedAwayCount}건을 제거하고 더 최신 연도 파일의 데이터를 채택했습니다. 남은 대출의 최종 회차 잔여잔금이 0이 아니어서(대환으로 잔액이 신규 대출로 이전됨) status='refinanced'로 판단했습니다 — 0이었다면 'paid_off'로 판단했을 것입니다(코드의 판단 로직 참고).`,
  );
}

// ---------------------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------------------

const outputPath = path.join(OUTPUT_DIR, 'dry-run-output.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

// ---------------------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------------------

function countBy(array, keyFn) {
  const map = new Map();
  for (const item of array) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

const txnByYear = countBy(
  output.transactions.filter((t) => t.source_month),
  (t) => t.source_month.slice(0, 4),
);
const incomeByYear = new Map();
const expenseByYear = new Map();
for (const t of output.transactions) {
  const year = t.source_month ? t.source_month.slice(0, 4) : t.transaction_date.slice(0, 4);
  if (t.transaction_type === 'income') incomeByYear.set(year, (incomeByYear.get(year) ?? 0) + t.amount);
  if (t.transaction_type === 'expense') expenseByYear.set(year, (expenseByYear.get(year) ?? 0) + t.amount);
}

const lines = [];
lines.push('# Excel -> DB 마이그레이션 드라이런 결과 요약');
lines.push('');
lines.push(`생성 시각: ${new Date().toISOString()}`);
lines.push('');
lines.push('이 문서는 DB에 아무것도 쓰지 않은 순수 파싱/검증 결과입니다 (scripts/excel-migration/dry-run.cjs).');
lines.push('');
lines.push('## 1. 테이블별 건수');
lines.push('');
lines.push('| 테이블 | 건수 |');
lines.push('|---|---|');
for (const [table, rows] of Object.entries(output)) {
  lines.push(`| ${table} | ${rows.length} |`);
}
lines.push('');
lines.push(`(참고: 월별 거래 파싱 건수 = ${monthlyTransactionCount}건 — 정부지원금/축의금·부조금 거래는 위 transactions 합계에 포함되어 있음)`);
lines.push('');

lines.push('## 2. 연도별 거래 건수 및 금액 (transactions 기준, DB 저장 예정 값)');
lines.push('');
lines.push('| 연도 | 거래건수(월별시트기준) | 수입 합계 | 지출 합계 |');
lines.push('|---|---|---|---|');
for (const year of YEARS.map(String)) {
  lines.push(`| ${year} | ${txnByYear.get(year) ?? 0} | ${(incomeByYear.get(year) ?? 0).toLocaleString('ko-KR')} | ${(expenseByYear.get(year) ?? 0).toLocaleString('ko-KR')} |`);
}
lines.push('');
lines.push('(수입/지출 합계는 정부지원금·축의금&부조금에서 파생된 transactions 행도 해당 연도에 포함합니다. Excel 자체의 결산/연간_* 집계 시트와의 교차검증은 이번 드라이런 범위 밖입니다 — 다음 단계에서 비교 필요.)');
lines.push('');

lines.push('## 3. 검증 오류 (validation errors)');
lines.push('');
lines.push(`총 ${validationErrors.length}건`);
lines.push('');
if (validationErrors.length > 0) {
  const byTable = countBy(validationErrors, (e) => e.table);
  lines.push('| 테이블 | 오류 건수 |');
  lines.push('|---|---|');
  for (const [table, count] of byTable) lines.push(`| ${table} | ${count} |`);
  lines.push('');
  lines.push('<details><summary>전체 오류 목록 펼치기</summary>');
  lines.push('');
  lines.push('| 테이블 | 파일 | 시트 | 행 | 메시지 |');
  lines.push('|---|---|---|---|---|');
  for (const e of validationErrors) {
    lines.push(`| ${e.table} | ${e.file} | ${e.sheet} | ${e.rowIndex ?? ''} | ${e.message.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
}

lines.push('## 4. 매핑되지 않은/확신할 수 없는 항목 (unmapped)');
lines.push('');
lines.push(`총 ${unmapped.length}건 — 임의로 추정하지 않고 목록으로만 남겼습니다.`);
lines.push('');
if (unmapped.length > 0) {
  lines.push('<details><summary>전체 unmapped 목록 펼치기</summary>');
  lines.push('');
  lines.push('| 파일 | 시트 | 행 | 사유 | 원본 |');
  lines.push('|---|---|---|---|---|');
  for (const u of unmapped) {
    lines.push(`| ${u.file} | ${u.sheet} | ${u.rowIndex ?? ''} | ${u.reason.replace(/\|/g, '\\|')} | ${(u.raw ?? '').toString().slice(0, 300).replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
}

lines.push('## 5. 추정 날짜로 처리된 항목 (2026-09-03 사용자 승인)');
lines.push('');
lines.push(
  `날짜를 원본에서 확정할 수 없었지만(금액 등 나머지 정보는 확인됨) 사용자 승인에 따라 제외하지 않고, 해당 워크북 연도의 1월 1일을 transaction_date로 사용 + needs_review=true로 표시하여 transactions에 포함한 항목입니다. 임의 처리를 숨기지 않기 위해 전부 나열합니다. 총 ${estimatedDateItems.length}건 (정부지원금 ${supportEstimatedDateCount}건 + 축의금&부조금 받은내역 ${eventEstimatedDateCount}건).`,
);
lines.push('');
if (estimatedDateItems.length > 0) {
  lines.push('<details><summary>전체 추정 날짜 항목 목록 펼치기</summary>');
  lines.push('');
  lines.push('| 구분 | 파일 | 시트 | 행 | 내용 | 추정 transaction_date |');
  lines.push('|---|---|---|---|---|---|');
  for (const e of estimatedDateItems) {
    lines.push(`| ${e.table} | ${e.file} | ${e.sheet} | ${e.rowIndex ?? ''} | ${String(e.description).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')} | ${e.estimatedDate} |`);
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');
}

if (skippedOutOfScope.length > 0) {
  lines.push('## 6. 마이그레이션 범위 밖으로 판단해 제외한 항목');
  lines.push('');
  lines.push('| 파일 | 시트 | 사유 |');
  lines.push('|---|---|---|');
  for (const s of skippedOutOfScope) lines.push(`| ${s.file} | ${s.sheet} | ${s.reason.replace(/\|/g, '\\|')} |`);
  lines.push('');
}

lines.push('## 7. 파서 갭 / 의도적 편차 (findings)');
lines.push('');
for (const f of findings) lines.push(`- ${f}`);
lines.push('');

lines.push('## 8. 명시적으로 import하지 않은 시트 (승인된 계획대로)');
lines.push('');
lines.push('- 예산: 4개 연도 모두 빈 템플릿으로 확인되어 제외');
lines.push('- 결산, 연간_항목별수입, 연간_카드별지출, 연간_항목별지출, 연간_세부항목별지출, 부채관리: 집계/롤업 시트로, 원칙(§3)에 따라 거래로 중복 저장하지 않고 향후 교차검증에만 사용');
lines.push('- 메인 시트 재무목표/재무일정: 자유 텍스트 메모 구조라 구조화된 목표로 무리하게 매핑하지 않고 제외 (승인됨)');
lines.push('- 항목: 기존 categories/subcategories 재사용, 신규 생성 없음');
lines.push('');

fs.writeFileSync(path.join(OUTPUT_DIR, 'dry-run-summary.md'), lines.join('\n'), 'utf8');

console.log('Dry run complete.');
console.log('Table counts:');
for (const [table, rows] of Object.entries(output)) console.log(`  ${table}: ${rows.length}`);
console.log(`validationErrors: ${validationErrors.length}`);
console.log(`unmapped: ${unmapped.length}`);
console.log(`Output written to: ${outputPath}`);
console.log(`Summary written to: ${path.join(OUTPUT_DIR, 'dry-run-summary.md')}`);
