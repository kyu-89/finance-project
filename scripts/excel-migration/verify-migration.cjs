'use strict';
/**
 * READ-ONLY post-migration verification (docs §8). Makes zero writes — only SELECT/aggregate
 * queries against the live DB (household 558ae2c6-...) plus reading the source .xlsm files for
 * the Excel-side "official" figures to compare against. Prints everything needed for
 * .superpowers/excel-migration/FINAL-REPORT.md §5.
 */
const path = require('path');
const { config: loadEnv } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.join(__dirname, '..', '..');
loadEnv({ path: path.join(ROOT, '.env.test.local') });
loadEnv({ path: path.join(ROOT, '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const HOUSEHOLD_ID = '558ae2c6-79b3-43db-9809-ee55d5dd24f2';

async function fetchAll(table, select) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from(table).select(select).eq('household_id', HOUSEHOLD_ID).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function countForHousehold(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('household_id', HOUSEHOLD_ID);
  if (error) throw new Error(`count failed (${table}): ${error.message}`);
  return count ?? 0;
}

function sum(arr, fn) {
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0);
}

async function main() {
  console.log('='.repeat(78));
  console.log('마이그레이션 후 검증 (읽기 전용)');
  console.log('='.repeat(78));

  const tables = ['accounts', 'cards', 'assets', 'deposits', 'savings_accounts', 'insurances', 'loans', 'loan_payments', 'transactions', 'transaction_support_details', 'transaction_event_details', 'investment_transactions'];
  console.log('\n[테이블별 현재 건수]');
  const counts = {};
  for (const t of tables) {
    counts[t] = await countForHousehold(t);
    console.log(`  ${t}: ${counts[t]}`);
  }

  console.log('\n[연도별 transactions 수입/지출/환불 합계]');
  const txns = await fetchAll('transactions', 'transaction_date, transaction_type, amount, category_id, needs_review');
  const catRows = await fetchAll('categories', 'id, name, transaction_type');
  const catNameById = new Map(catRows.map((c) => [c.id, c.name]));
  const savingCatId = catRows.find((c) => c.name === '저축성지출' && c.transaction_type === 'expense')?.id ?? null;

  const byYear = new Map();
  for (const t of txns) {
    const year = t.transaction_date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, { income: 0, expenseGross: 0, refund: 0, savingExpense: 0, needsReview: 0, count: 0 });
    const g = byYear.get(year);
    g.count += 1;
    if (t.needs_review) g.needsReview += 1;
    if (t.transaction_type === 'income') g.income += t.amount;
    else if (t.transaction_type === 'expense') {
      g.expenseGross += t.amount;
      if (t.category_id === savingCatId) g.savingExpense += t.amount;
    } else if (t.transaction_type === 'refund') g.refund += t.amount;
  }
  for (const year of [...byYear.keys()].sort()) {
    const g = byYear.get(year);
    const consumptionExpense = g.expenseGross - g.savingExpense; // 소비성지출 = 전체 지출 - 저축성지출
    const netAfterRefund = consumptionExpense - g.refund; // Excel 결산 방식(원본 raw 음수 반영)과 맞추기 위한 환불 차감
    console.log(`  ${year}: count=${g.count} income=${g.income} expenseGross=${g.expenseGross} savingExpense=${g.savingExpense} consumptionExpense=${consumptionExpense} refund=${g.refund} consumptionNetOfRefund=${netAfterRefund} needsReview=${g.needsReview}`);
  }

  console.log('\n[2025년 카테고리별 지출 top (DB)]');
  const catTotals = new Map();
  for (const t of txns) {
    if (t.transaction_date.slice(0, 4) !== '2025' || t.transaction_type !== 'expense') continue;
    const name = catNameById.get(t.category_id) ?? '(미분류/null)';
    catTotals.set(name, (catTotals.get(name) ?? 0) + t.amount);
  }
  for (const [name, total] of [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${name}: ${total}`);

  console.log('\n[2025년 결제수단별 지출 top (DB)]');
  const txnsWithPm = await fetchAll('transactions', 'transaction_date, transaction_type, amount, payment_method_id');
  const pmRows = await fetchAll('payment_methods', 'id, name');
  const pmNameById = new Map(pmRows.map((p) => [p.id, p.name]));
  const pmTotals = new Map();
  for (const t of txnsWithPm) {
    if (t.transaction_date.slice(0, 4) !== '2025' || t.transaction_type !== 'expense') continue;
    const name = pmNameById.get(t.payment_method_id) ?? '(미매핑/null)';
    pmTotals.set(name, (pmTotals.get(name) ?? 0) + t.amount);
  }
  for (const [name, total] of [...pmTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${name}: ${total}`);

  console.log('\n[accounts.current_balance 합계]');
  const accounts = await fetchAll('accounts', 'current_balance');
  console.log(`  DB 합계: ${sum(accounts, (a) => a.current_balance)} (건수 ${accounts.length})`);

  console.log('\n[investment_transactions.settled_amount 합계]');
  const trades = await fetchAll('investment_transactions', 'settled_amount, trade_type');
  console.log(`  DB 합계(전체): ${sum(trades, (t) => Number(t.settled_amount))} (건수 ${trades.length})`);
  console.log(`  DB 합계(매수): ${sum(trades.filter((t) => t.trade_type === 'buy'), (t) => Number(t.settled_amount))}`);
  console.log(`  DB 합계(매도): ${sum(trades.filter((t) => t.trade_type === 'sell'), (t) => Number(t.settled_amount))}`);

  console.log('\n[loans + 최종 회차 잔여잔금]');
  const loans = await fetchAll('loans', 'id, institution_name, loan_name, status, original_amount');
  const payments = await fetchAll('loan_payments', 'loan_id, installment, remaining_balance');
  for (const loan of loans) {
    const loanPayments = payments.filter((p) => p.loan_id === loan.id).sort((a, b) => b.installment - a.installment);
    const last = loanPayments[0];
    console.log(`  ${loan.institution_name}/${loan.loan_name} status=${loan.status} original=${loan.original_amount} last_installment=${last?.installment} last_remaining_balance=${last?.remaining_balance}`);
  }

  console.log('\n' + '='.repeat(78));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
