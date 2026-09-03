'use strict';
/**
 * ONE-OFF READ-ONLY ANALYSIS (not part of the migration pipeline, does not modify
 * execute-migration.cjs or dry-run.cjs). Groups the ~231 transactions whose category/
 * subcategory/payment_method name failed exact-match resolution (same logic as
 * execute-migration.cjs's resolveTransactionMapping) by original name, and gathers evidence
 * (항목 sheet content, existing DB categories/subcategories/payment_methods, sibling-overlap)
 * for a human (not this script) to decide on aliases. Makes NO writes of any kind.
 */
const path = require('path');
const fs = require('fs');
const { config: loadEnv } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..', '..');
// Real transaction data lives in the gitignored scratch dir, not alongside this committed script.
const OUTPUT_DIR = path.join(ROOT, '.superpowers', 'excel-migration');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
loadEnv({ path: path.join(ROOT, '.env.test.local') });
loadEnv({ path: path.join(ROOT, '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const HOUSEHOLD_ID = '558ae2c6-79b3-43db-9809-ee55d5dd24f2';

const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'dry-run-output.json'), 'utf8'));

function resolveTransactionMapping(row, maps) {
  const categoryType = row.transaction_type === 'refund' ? 'expense' : row.transaction_type;
  const failures = [];
  let categoryId = null;
  let subcategoryId = null;
  let paymentMethodId = null;
  if (row._category_name) {
    categoryId = maps.categoryMap.get(`${categoryType}|${row._category_name}`) ?? null;
    if (!categoryId) failures.push('category');
  }
  if (row._subcategory_name && categoryId) {
    subcategoryId = maps.subcategoryMap.get(`${categoryId}|${row._subcategory_name}`) ?? null;
    if (!subcategoryId) failures.push('subcategory');
  } else if (row._subcategory_name && !categoryId) {
    failures.push('subcategory');
  }
  if (row._payment_method_name) {
    paymentMethodId = maps.paymentMethodMap.get(row._payment_method_name) ?? null;
    if (!paymentMethodId) failures.push('payment_method');
  }
  return { categoryType, categoryId, subcategoryId, paymentMethodId, failures };
}

// Read 항목 sheet from all 4 workbooks (evidence source) -- header row: col1='지출구분' (payment
// methods list below it), cols 2+ = category names, rows below = that category's subcategories.
function readItemSheet(file) {
  const wbPath = path.join(ROOT, file);
  const wb = XLSX.readFile(wbPath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['항목'], { header: 1, raw: true, defval: '' });
  const headerRowIdx = rows.findIndex((r) => String(r[1] ?? '').trim() === '지출구분');
  if (headerRowIdx < 0) return { paymentMethods: [], categories: {} };
  const header = rows[headerRowIdx];
  const categoryCols = [];
  for (let c = 2; c < header.length; c += 1) {
    const name = String(header[c] ?? '').trim();
    if (name) categoryCols.push({ col: c, name });
  }
  const paymentMethods = new Set();
  const categories = {};
  for (const cc of categoryCols) categories[cc.name] = new Set();
  for (let r = headerRowIdx + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const pm = String(row[1] ?? '').trim();
    if (pm) paymentMethods.add(pm);
    for (const cc of categoryCols) {
      const sub = String(row[cc.col] ?? '').trim();
      if (sub) categories[cc.name].add(sub);
    }
  }
  return { paymentMethods: [...paymentMethods], categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, [...v]])) };
}

// Cheap similarity: normalized containment / Levenshtein distance <= 2 (Korean short strings).
function normalize(s) {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i += 1) {
    dp.push(new Array(n + 1).fill(0));
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
function similarCandidates(target, candidates, maxDistance) {
  const t = normalize(target);
  return candidates
    .map((c) => ({ name: c, dist: levenshtein(t, normalize(c)), contains: normalize(c).includes(t) || t.includes(normalize(c)) }))
    .filter((c) => c.dist <= maxDistance || c.contains)
    .sort((a, b) => a.dist - b.dist);
}

async function main() {
  const catResp = await supabase.from('categories').select('id, name, transaction_type').eq('household_id', HOUSEHOLD_ID);
  if (catResp.error) throw catResp.error;
  const catRows = catResp.data;
  const subResp = await supabase.from('subcategories').select('id, name, category_id, categories!inner(id, name, transaction_type, household_id)').eq('categories.household_id', HOUSEHOLD_ID);
  if (subResp.error) throw subResp.error;
  const subRows = subResp.data;
  const pmResp = await supabase.from('payment_methods').select('id, name').eq('household_id', HOUSEHOLD_ID);
  if (pmResp.error) throw pmResp.error;
  const pmRows = pmResp.data;

  const categoryMap = new Map(catRows.map((r) => [`${r.transaction_type}|${r.name}`, r.id]));
  const subcategoryMap = new Map(subRows.map((r) => [`${r.category_id}|${r.name}`, r.id]));
  const paymentMethodMap = new Map(pmRows.map((r) => [r.name, r.id]));
  const maps = { categoryMap, subcategoryMap, paymentMethodMap };

  const allCategoryNamesByType = {
    income: catRows.filter((r) => r.transaction_type === 'income').map((r) => r.name),
    expense: catRows.filter((r) => r.transaction_type === 'expense').map((r) => r.name),
  };
  const allPaymentMethodNames = pmRows.map((r) => r.name);
  const subsByCategoryId = new Map();
  for (const r of subRows) {
    if (!subsByCategoryId.has(r.category_id)) subsByCategoryId.set(r.category_id, []);
    subsByCategoryId.get(r.category_id).push(r.name);
  }
  const categoryNameById = new Map(catRows.map((r) => [r.id, r.name]));
  const subNameToCategories = new Map();
  for (const r of subRows) {
    if (!subNameToCategories.has(r.name)) subNameToCategories.set(r.name, []);
    subNameToCategories.get(r.name).push(categoryNameById.get(r.category_id));
  }

  const itemSheets = {};
  for (const f of ['2023년.xlsm', '2024년.xlsm', '2025년.xlsm', '2026년.xlsm']) itemSheets[f] = readItemSheet(f);

  const categoryFailures = new Map();
  const subcategoryFailures = new Map();
  const paymentMethodFailures = new Map();

  for (const row of data.transactions) {
    const mapping = resolveTransactionMapping(row, maps);
    if (mapping.failures.includes('category')) {
      const key = `${mapping.categoryType}|${row._category_name}`;
      if (!categoryFailures.has(key)) categoryFailures.set(key, { type: mapping.categoryType, name: row._category_name, count: 0, sources: [], siblingSubcatNames: new Set() });
      const g = categoryFailures.get(key);
      g.count += 1;
      if (g.sources.length < 5) g.sources.push({ description: row.description, source: row._source });
      if (row._subcategory_name) g.siblingSubcatNames.add(row._subcategory_name);
    }
    if (mapping.failures.includes('subcategory')) {
      const catLabel = row._category_name ?? '(없음)';
      const key = `${catLabel}|${row._subcategory_name}`;
      if (!subcategoryFailures.has(key)) subcategoryFailures.set(key, { categoryNameRaw: catLabel, categoryId: mapping.categoryId, name: row._subcategory_name, count: 0, sources: [] });
      const g = subcategoryFailures.get(key);
      g.count += 1;
      if (g.sources.length < 5) g.sources.push({ description: row.description, source: row._source });
    }
    if (mapping.failures.includes('payment_method')) {
      const key = row._payment_method_name;
      if (!paymentMethodFailures.has(key)) paymentMethodFailures.set(key, { name: key, count: 0, sources: [] });
      const g = paymentMethodFailures.get(key);
      g.count += 1;
      if (g.sources.length < 5) g.sources.push({ description: row.description, source: row._source });
    }
  }

  const lines = [];
  lines.push('# 매핑 실패 이름 그룹 분석 (231건) - 근거 및 후보 정리');
  lines.push('');
  lines.push('이 문서는 분석 전용입니다. execute-migration.cjs/dry-run.cjs 코드는 수정하지 않았고, 어떤 alias도 자동 적용하지 않았습니다. 근거가 약하면 "판단불가"로 명시했습니다.');
  lines.push('');
  lines.push('생성 시각: ' + new Date().toISOString());
  lines.push('');
  lines.push('## 0. 참고 데이터');
  lines.push('');
  lines.push('### 0.1 실제 DB categories (household 558ae2c6...)');
  lines.push('');
  lines.push('- expense: ' + allCategoryNamesByType.expense.join(', '));
  lines.push('- income: ' + allCategoryNamesByType.income.join(', '));
  lines.push('');
  lines.push('### 0.2 실제 DB payment_methods');
  lines.push('');
  lines.push(allPaymentMethodNames.join(', '));
  lines.push('');
  lines.push('### 0.3 Excel "항목" 시트 (기준 데이터) - 연도별 category 헤더 비교');
  lines.push('');
  for (const file of Object.keys(itemSheets)) {
    lines.push('- ' + file + ': 카테고리 목록 = ' + Object.keys(itemSheets[file].categories).join(', '));
  }
  lines.push('');
  lines.push('(참고: "경조사회비"라는 문자열은 4개 연도 "항목" 시트 카테고리 헤더 어디에도 등장하지 않습니다 - 모든 연도의 공식 기준 목록은 "이벤트지출"만 사용합니다.)');
  lines.push('');

  lines.push('## 1. 매칭 실패한 category명');
  lines.push('');
  let categoryTotal = 0;
  for (const g of categoryFailures.values()) categoryTotal += g.count;
  lines.push('그룹 수: ' + categoryFailures.size + ', 영향 transaction 합계: ' + categoryTotal + '건');
  lines.push('');
  lines.push('| 원본 category명 (거래유형) | 영향 건수 | 후보 및 근거 |');
  lines.push('|---|---|---|');
  let categoryUndecided = 0;
  const sortedCategoryGroups = [...categoryFailures.values()].sort((a, b) => b.count - a.count);
  for (const g of sortedCategoryGroups) {
    const officialSideCategoryNames = allCategoryNamesByType[g.type] ?? [];
    const stringCandidates = similarCandidates(g.name, officialSideCategoryNames, 2).filter((c) => c.name !== g.name);
    let bestOverlapCategory = null;
    let bestOverlapScore = 0;
    for (const catRow of catRows.filter((r) => r.transaction_type === g.type)) {
      const officialSubs = new Set(subsByCategoryId.get(catRow.id) ?? []);
      let overlap = 0;
      for (const s of g.siblingSubcatNames) if (officialSubs.has(s)) overlap += 1;
      if (overlap > bestOverlapScore) {
        bestOverlapScore = overlap;
        bestOverlapCategory = catRow.name;
      }
    }
    let verdict;
    if (bestOverlapScore >= 2) {
      const overlapEvidence = '실제 하위 소분류 [' + [...g.siblingSubcatNames].join(', ') + '] 중 ' + bestOverlapScore + '개가 기존 "' + bestOverlapCategory + '" 카테고리의 실제 하위 소분류와 정확히 일치';
      verdict = '**"' + bestOverlapCategory + '"로 개명(rename) 추정** - ' + overlapEvidence + '. 항목 시트에도 "' + g.name + '"는 없고 "' + bestOverlapCategory + '"만 존재.';
    } else if (officialSideCategoryNames.length === 1) {
      // Structural evidence, not string similarity: this transaction_type has exactly one
      // category in the whole household (income -> "수입" is the sole income category by the
      // app's own design, per src/lib/categories.ts's DEFAULT_INCOME_SUBCATEGORY_NAMES comment
      // "income has a single implicit 대분류"). Any income-type row MUST resolve to it; there is
      // no other valid destination, so this is stronger than a fuzzy name guess even though the
      // subcategory itself may still not exist under it.
      verdict = '**구조적 후보: "' + officialSideCategoryNames[0] + '"** - 이 household는 "' + g.type + '" 유형 카테고리가 정확히 "' + officialSideCategoryNames[0] + '" 1개만 존재합니다(설계상 income은 카테고리가 하나뿐). 이름 유사성이 아니라 "이 거래유형에 존재하는 유일한 카테고리"라는 구조적 근거이며, 소분류(예: "기타 수입")는 별도 확인 필요.';
    } else if (stringCandidates.length > 0) {
      verdict = '문자열 유사 후보: ' + stringCandidates.map((c) => c.name).join(', ') + ' (약한 근거, 하위 소분류 중복 없음) - 판단불가에 가까움';
      categoryUndecided += 1;
    } else {
      verdict = '판단불가 - 기존 카테고리와 이름/하위소분류 유사성 근거 없음. 새 개념일 가능성.';
      categoryUndecided += 1;
    }
    lines.push('| "' + g.name + '" (' + g.type + ') | ' + g.count + ' | ' + verdict + ' |');
  }
  lines.push('');
  lines.push('<details><summary>category 그룹별 샘플 거래 보기</summary>');
  lines.push('');
  for (const g of sortedCategoryGroups) {
    lines.push('**"' + g.name + '" (' + g.type + ', ' + g.count + '건)** - 등장한 소분류: ' + ([...g.siblingSubcatNames].join(', ') || '(없음)'));
    for (const s of g.sources) lines.push('  - "' + s.description + '" (' + JSON.stringify(s.source) + ')');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  lines.push('## 2. 매칭 실패한 subcategory명');
  lines.push('');
  let subTotal = 0;
  for (const g of subcategoryFailures.values()) subTotal += g.count;
  lines.push('그룹 수: ' + subcategoryFailures.size + ', 영향 transaction 합계: ' + subTotal + '건');
  lines.push('');
  lines.push('| 원본 category명 | 원본 subcategory명 | 영향 건수 | 후보 및 근거 |');
  lines.push('|---|---|---|---|');
  let subUndecided = 0;
  const sortedSubGroups = [...subcategoryFailures.values()].sort((a, b) => b.count - a.count);
  for (const g of sortedSubGroups) {
    let verdict;
    const targetCategoryId = g.categoryId;
    if (targetCategoryId) {
      const siblingSubs = subsByCategoryId.get(targetCategoryId) ?? [];
      const cands = similarCandidates(g.name, siblingSubs, 2);
      if (cands.length > 0) {
        verdict = '"' + g.categoryNameRaw + '" 카테고리 산하 실제 존재 소분류 중 유사: ' + cands.map((c) => '"' + c.name + '"(편집거리 ' + c.dist + ')').join(', ');
      } else {
        const elsewhere = subNameToCategories.get(g.name);
        if (elsewhere) {
          verdict = '"' + g.categoryNameRaw + '" 산하에는 없지만, 다른 카테고리(' + [...new Set(elsewhere)].join(', ') + ') 산하에는 정확히 같은 이름의 소분류가 존재 - 카테고리 배정 자체가 다를 수 있음(판단 근거 약함)';
          subUndecided += 1;
        } else {
          verdict = '판단불가 - 상위 카테고리는 매핑되었으나 이름/유사도 근거로 특정할 후보 없음';
          subUndecided += 1;
        }
      }
    } else {
      verdict = '상위 카테고리("' + g.categoryNameRaw + '") 자체가 매핑 실패라 판단 보류 - 위 1번 표의 category 판단에 따라 결정 필요';
      subUndecided += 1;
    }
    lines.push('| "' + g.categoryNameRaw + '" | "' + g.name + '" | ' + g.count + ' | ' + verdict + ' |');
  }
  lines.push('');
  lines.push('<details><summary>subcategory 그룹별 샘플 거래 보기</summary>');
  lines.push('');
  for (const g of sortedSubGroups) {
    lines.push('**"' + g.categoryNameRaw + '" / "' + g.name + '" (' + g.count + '건)**');
    for (const s of g.sources) lines.push('  - "' + s.description + '" (' + JSON.stringify(s.source) + ')');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  lines.push('## 3. 매칭 실패한 payment_method명');
  lines.push('');
  let pmTotal = 0;
  for (const g of paymentMethodFailures.values()) pmTotal += g.count;
  lines.push('그룹 수: ' + paymentMethodFailures.size + ', 영향 transaction 합계: ' + pmTotal + '건');
  lines.push('');
  lines.push('| 원본 payment_method명 | 영향 건수 | 후보 및 근거 |');
  lines.push('|---|---|---|');
  let pmUndecided = 0;
  const sortedPmGroups = [...paymentMethodFailures.values()].sort((a, b) => b.count - a.count);
  for (const g of sortedPmGroups) {
    const cands = similarCandidates(g.name, allPaymentMethodNames, 2);
    let verdict;
    if (cands.length > 0) {
      verdict = '유사 후보: ' + cands.map((c) => '"' + c.name + '"(편집거리 ' + c.dist + ')').join(', ');
    } else {
      verdict = '판단불가 - 기존 payment_methods 목록에 유사 표기 없음(신규 카드/결제수단일 가능성)';
      pmUndecided += 1;
    }
    lines.push('| "' + g.name + '" | ' + g.count + ' | ' + verdict + ' |');
  }
  lines.push('');
  lines.push('<details><summary>payment_method 그룹별 샘플 거래 보기</summary>');
  lines.push('');
  for (const g of sortedPmGroups) {
    lines.push('**"' + g.name + '" (' + g.count + '건)**');
    for (const s of g.sources) lines.push('  - "' + s.description + '" (' + JSON.stringify(s.source) + ')');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  const totalGroups = categoryFailures.size + subcategoryFailures.size + paymentMethodFailures.size;
  const totalUndecided = categoryUndecided + subUndecided + pmUndecided;
  lines.push('## 4. 요약');
  lines.push('');
  lines.push('- 전체 그룹 수: ' + totalGroups + ' (category ' + categoryFailures.size + ' + subcategory ' + subcategoryFailures.size + ' + payment_method ' + paymentMethodFailures.size + ')');
  lines.push('- 전체 영향 transaction 건수(중복 가능, 한 거래가 여러 필드에서 동시 실패할 수 있음): category ' + categoryTotal + ' + subcategory ' + subTotal + ' + payment_method ' + pmTotal);
  lines.push('- "판단불가"로 표시된 그룹 수: ' + totalUndecided);
  lines.push('');

  const outPath = path.join(OUTPUT_DIR, 'unmatched-names-report.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', outPath);
  console.log('category groups:', categoryFailures.size, 'subcategory groups:', subcategoryFailures.size, 'payment_method groups:', paymentMethodFailures.size);
  console.log('undecided:', totalUndecided, '/ total groups:', totalGroups);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
