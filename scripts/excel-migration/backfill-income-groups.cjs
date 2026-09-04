'use strict';
/**
 * 2026-09: 부가수입 통째 누락 파서 버그(src/lib/transaction-import.ts의 mapMonthlySheetRows,
 * "같은 종류의 다음 헤더" 수정) 이후 실행하는 백필 스크립트.
 *
 * 4개 워크북(2023~2026)의 모든 월별 탭을 고정된 파서로 다시 읽어, 수입 거래만:
 *   - DB에 이미 있는 거래(household_id+transaction_date+amount+description으로 매칭)는
 *     income_group만 채워 넣는다(다른 컬럼은 절대 건드리지 않음).
 *   - DB에 아직 없는 거래(대부분 버그로 빠졌던 부가수입)는 새로 insert한다.
 * 기존 거래를 삭제하거나 금액/날짜를 바꾸는 동작은 전혀 없다 — 순수 추가/보강뿐.
 *
 * SAFETY: 기본은 DRY RUN(읽기 전용 계산 + 콘솔 출력만). --execute를 줘야 실제로 쓴다.
 * Run (안전, 읽기 전용): node scripts/excel-migration/backfill-income-groups.cjs
 * Run (실제 반영):       node scripts/excel-migration/backfill-income-groups.cjs --execute
 */

const path = require('path');
const XLSX = require('xlsx');
const { config: loadEnv } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..', '..');
loadEnv({ path: path.join(ROOT, '.env.test.local') });
loadEnv({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('필수 환경변수가 없습니다 (.env.local의 NEXT_PUBLIC_SUPABASE_URL, .env.test.local의 SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const EXECUTE = process.argv.includes('--execute');
const HOUSEHOLD_ID = '558ae2c6-79b3-43db-9809-ee55d5dd24f2';
const WORKBOOK_FILES = ['2023년.xlsm', '2024년.xlsm', '2025년.xlsm', '2026년.xlsm'];

// ---------------------------------------------------------------------------------------
// src/lib/transaction-import.ts를 그대로 옮긴 부분(고친 뒤 버전) — 로직을 다시 만들지 않고
// 문자 그대로 베낀다. 유일하게 추가한 것은 각 income 행에 blockIndex(0=첫 번째=고정수입,
// 1=두 번째=부가수입) 표시.
// ---------------------------------------------------------------------------------------
function formatDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function normalizeImportDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return formatDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  const match = text.match(/^(\d{2,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (!match) return null;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  return formatDate(year, Number(match[2]), Number(match[3]));
}
function normalizeImportAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return { amount: Math.abs(Math.round(value)), negative: value < 0 };
  const text = String(value ?? '').trim();
  if (!text) return { amount: null, negative: false };
  const negative = /^[-₩원\s]*-/.test(text) || /-$/.test(text) || /^\(.*\)$/.test(text);
  const numeric = Number(text.replace(/[₩원,\s]/g, '').replace(/^\((.*)\)$/, '$1').replace(/-$/, ''));
  return Number.isFinite(numeric) ? { amount: Math.abs(Math.round(numeric)), negative } : { amount: null, negative };
}
function isRefund(status) {
  return /취소|환불|반품|cancel|refund|return/i.test(String(status ?? ''));
}

function mapMonthlySheetIncomeRows(rows, sourceMonth) {
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
  const incomeBlocks = blocks.filter((b) => b.kind === 'income');
  const result = [];
  for (const block of blocks) {
    const nextHeader = blocks.find((c) => c.headerRow > block.headerRow && c.kind === block.kind)?.headerRow ?? rows.length;
    if (block.kind !== 'income') continue; // 이 스크립트는 수입만 다룬다
    const blockIndex = incomeBlocks.indexOf(block); // 0=고정수입, 1=부가수입
    for (let index = block.headerRow + 1; index < nextHeader; index += 1) {
      const row = rows[index] ?? [];
      const data = { date: row[block.start], category: row[block.start + 1], subcategory: row[block.start + 2], description: row[block.start + 3], amount: row[block.start + 4] };
      if (![data.date, data.category, data.description, data.amount].some((v) => String(v ?? '').trim() !== '')) continue;
      if (data.amount !== undefined && normalizeImportAmount(data.amount).amount === null && /사용|미정|확인/.test(String(data.amount))) continue;
      const parsedDate = normalizeImportDate(data.date);
      const parsedAmount = normalizeImportAmount(data.amount);
      const description = String(data.description ?? '').trim();
      if (!parsedDate || !description || parsedAmount.amount === null || parsedAmount.amount <= 0) continue;
      result.push({
        transactionDate: parsedDate, amount: parsedAmount.amount,
        transactionType: isRefund(null) ? 'refund' : 'income',
        description, subcategoryName: String(data.subcategory ?? '').trim() || null,
        sourceMonth, blockIndex,
      });
    }
  }
  return result;
}

const dedupeKey = (row) => `${row.transactionDate}|income|${row.amount}|${row.description.trim().toLowerCase()}`;

async function main() {
  console.log(EXECUTE ? '=== 실행 모드(--execute) ===' : '=== DRY RUN (읽기 전용) ===');

  // 1) 수입 카테고리/소분류 id 조회(이름으로 — 이미 엑셀 항목 시트와 정확히 일치함이 이번 세션에
  // 확인됐다).
  const { data: incomeCategory, error: catError } = await supabase.from('categories')
    .select('id').eq('household_id', HOUSEHOLD_ID).eq('transaction_type', 'income').eq('name', '수입').single();
  if (catError || !incomeCategory) throw new Error(`수입 카테고리 조회 실패: ${catError?.message ?? '없음'}`);
  const { data: subcats, error: subError } = await supabase.from('subcategories').select('id, name').eq('category_id', incomeCategory.id);
  if (subError) throw new Error(`수입 소분류 조회 실패: ${subError.message}`);
  const subcategoryIdByName = new Map(subcats.map((s) => [s.name, s.id]));

  // 2) 이 가계의 기존 수입 거래를 전부 한 번에 가져와 dedupe 키로 인덱싱한다(soft-delete된 것도
  // 포함 — 이미 지운 거래를 되살리듯 다시 insert하면 안 되므로 deleted_at 상관없이 매칭 대상에
  // 넣는다).
  const existingByKey = new Map();
  {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('transactions')
        .select('id, transaction_date, amount, description, income_group, deleted_at')
        .eq('household_id', HOUSEHOLD_ID).eq('transaction_type', 'income')
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`기존 수입 거래 조회 실패: ${error.message}`);
      for (const row of data) existingByKey.set(`${row.transaction_date}|income|${row.amount}|${row.description.trim().toLowerCase()}`, row);
      if (data.length < pageSize) break;
    }
  }
  console.log(`기존 수입 거래 ${existingByKey.size}건 로드`);

  const toInsert = [];
  const toUpdateGroup = []; // { id, incomeGroup }
  let parsedTotal = 0;
  let skippedNoSubcategory = 0;
  const perFile = {};

  for (const file of WORKBOOK_FILES) {
    const full = path.join(ROOT, file);
    const workbook = XLSX.readFile(full, { cellDates: true });
    perFile[file] = { insert: 0, updateGroup: 0, alreadyOk: 0 };
    for (const sheetName of workbook.SheetNames) {
      const monthMatch = sheetName.match(/^(\d{1,2})월$/);
      if (!monthMatch) continue; // 월별 탭이 아닌 시트(항목/결산/연간_* 등)는 건너뛴다
      const year = Number(file.slice(0, 4));
      const month = Number(monthMatch[1]);
      const sourceMonth = `${year}-${String(month).padStart(2, '0')}`;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
      const incomeRows = mapMonthlySheetIncomeRows(rows, sourceMonth);
      parsedTotal += incomeRows.length;
      for (const row of incomeRows) {
        const incomeGroup = row.blockIndex === 0 ? 'fixed' : 'additional';
        const subcategoryId = row.subcategoryName ? subcategoryIdByName.get(row.subcategoryName) ?? null : null;
        if (row.subcategoryName && !subcategoryId) {
          skippedNoSubcategory += 1;
          console.warn(`  [건너뜀] ${file} ${sheetName} "${row.description}" — 소분류 "${row.subcategoryName}"를 DB에서 찾지 못함`);
          continue;
        }
        const key = dedupeKey(row);
        const existing = existingByKey.get(key);
        if (existing) {
          if (existing.deleted_at) continue; // 사용자가 지운 거래는 되살리지 않는다
          if (existing.income_group !== incomeGroup) {
            toUpdateGroup.push({ id: existing.id, incomeGroup });
            perFile[file].updateGroup += 1;
          } else {
            perFile[file].alreadyOk += 1;
          }
        } else {
          toInsert.push({
            household_id: HOUSEHOLD_ID, transaction_date: row.transactionDate, source_month: sourceMonth,
            transaction_type: 'income', flow_class: 'cash_in', category_id: incomeCategory.id,
            subcategory_id: subcategoryId, amount: row.amount, description: row.description,
            income_group: incomeGroup, include_in_budget: true, status: 'posted',
          });
          perFile[file].insert += 1;
        }
      }
    }
  }

  console.log(`\n파싱된 수입 행 총 ${parsedTotal}건 (소분류 매칭 실패로 건너뜀: ${skippedNoSubcategory}건)`);
  console.log('파일별 결과:');
  for (const [file, stats] of Object.entries(perFile)) {
    console.log(`  ${file}: 신규 삽입 ${stats.insert}건, income_group 보강 ${stats.updateGroup}건, 이미 정상 ${stats.alreadyOk}건`);
  }
  console.log(`\n총합: 신규 삽입 ${toInsert.length}건 (₩${toInsert.reduce((s, r) => s + r.amount, 0).toLocaleString('ko-KR')}), income_group 보강 ${toUpdateGroup.length}건`);

  if (!EXECUTE) {
    console.log('\nDRY RUN이므로 실제로 쓰지 않았습니다. --execute로 다시 실행하면 반영됩니다.');
    return;
  }

  let insertedCount = 0;
  const chunkSize = 500;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const part = toInsert.slice(i, i + chunkSize);
    const { error, count } = await supabase.from('transactions').insert(part, { count: 'exact' });
    if (error) { console.error(`insert 실패(${i}~${i + part.length}): ${error.message}`); continue; }
    insertedCount += count ?? part.length;
  }
  console.log(`삽입 완료: ${insertedCount}/${toInsert.length}`);

  let updatedCount = 0;
  for (const { id, incomeGroup } of toUpdateGroup) {
    const { error } = await supabase.from('transactions').update({ income_group: incomeGroup }).eq('id', id);
    if (error) { console.error(`income_group 갱신 실패(${id}): ${error.message}`); continue; }
    updatedCount += 1;
  }
  console.log(`income_group 보강 완료: ${updatedCount}/${toUpdateGroup.length}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
