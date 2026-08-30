'use client';

import * as XLSX from 'xlsx';
import { useState } from 'react';
import { getFinancialAuditCounts, type FinancialAuditCount } from '@/actions/financial-audit-actions';
import { parseAccountRows } from '@/lib/excel-account-import';
import { parseDepositRows, parseSavingsRows } from '@/lib/excel-savings-import';
import { parseLoanRows, parseInsuranceRows } from '@/lib/excel-loan-insurance-import';
import { parseInvestmentTradeRows } from '@/lib/excel-investment-import';
import { parseAssetRows } from '@/lib/excel-asset-card-import';

const money = new Intl.NumberFormat('ko-KR');
const rows = (workbook: XLSX.WorkBook, name: string) => workbook.Sheets[name] ? XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][] : [];
const sheet = (workbook: XLSX.WorkBook, names: string[]) => names.find((name) => workbook.SheetNames.includes(name));

export function FinancialAudit() {
  const [source, setSource] = useState<Record<string, { count: number; amount: number | null }>>({});
  const [actual, setActual] = useState<FinancialAuditCount[]>([]);
  const [message, setMessage] = useState('');
  async function handleFile(file: File) {
    setMessage(''); setSource({});
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true });
      const account = parseAccountRows(rows(workbook, sheet(workbook, ['계좌현황']) ?? ''));
      const deposits = parseDepositRows(rows(workbook, sheet(workbook, ['예금관리']) ?? ''));
      const savings = parseSavingsRows(rows(workbook, sheet(workbook, ['적금관리']) ?? ''));
      const loans = parseLoanRows(rows(workbook, sheet(workbook, ['대출']) ?? ''));
      const insurances = parseInsuranceRows(rows(workbook, sheet(workbook, ['보험']) ?? ''));
      const investments = parseInvestmentTradeRows(rows(workbook, sheet(workbook, ['입출금내역', '투자거래']) ?? ''));
      const assets = parseAssetRows(rows(workbook, sheet(workbook, ['기타자산']) ?? ''));
      setSource({ 계좌: { count: account.filter((row) => !row.errors.length).length, amount: account.reduce((sum, row) => sum + (row.currentBalance ?? 0), 0) }, 예금: { count: deposits.filter((row) => !row.errors.length).length, amount: deposits.reduce((sum, row) => sum + (row.principal ?? 0), 0) }, 적금: { count: savings.filter((row) => !row.errors.length).length, amount: savings.reduce((sum, row) => sum + (row.currentSavings ?? 0), 0) }, 대출: { count: loans.filter((row) => !row.errors.length).length, amount: loans.reduce((sum, row) => sum + (row.originalAmount ?? 0), 0) }, 보험: { count: insurances.filter((row) => !row.errors.length).length, amount: insurances.reduce((sum, row) => sum + (row.monthlyPremium ?? 0), 0) }, 투자거래: { count: investments.filter((row) => !row.errors.length).length, amount: investments.reduce((sum, row) => sum + (row.settledAmount ?? 0), 0) }, 기타자산: { count: assets.filter((row) => !row.errors.length).length, amount: assets.reduce((sum, row) => sum + (row.currentValue ?? 0), 0) } });
      setActual(await getFinancialAuditCounts());
    } catch (error) { setMessage(error instanceof Error ? error.message : '자산·금융상품 대조에 실패했어요.'); }
  }
  return <section className="tds-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">자산·금융상품 원본 대조</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">Excel 원본의 정상 행과 운영 DB의 건수·금액을 비교합니다.</p></div><label className="tds-button-secondary inline-flex cursor-pointer px-4"><span>Excel 선택</span><input className="sr-only" type="file" accept=".xlsx,.xls,.xlsm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /></label></div>{message && <p role="alert" className="mt-3 text-sm text-[var(--tds-red-500)]">{message}</p>}{actual.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-xs text-[var(--tds-grey-500)]"><th className="py-2 text-left">구분</th><th className="py-2 text-right">원본 건수</th><th className="py-2 text-right">DB 건수</th><th className="py-2 text-right">원본 금액</th><th className="py-2 text-right">DB 금액</th><th className="py-2 text-center">상태</th></tr></thead><tbody>{actual.map((item) => { const original = source[item.key]; const countMatch = original?.count === item.count; const amountMatch = original?.amount === null || original?.amount === item.amount; return <tr key={item.key} className="border-b border-[var(--tds-grey-100)]"><td className="py-2 font-medium">{item.key}</td><td className="py-2 text-right tabular-nums">{original?.count ?? '-'}</td><td className="py-2 text-right tabular-nums">{item.count}</td><td className="py-2 text-right tabular-nums">{original?.amount === null || original === undefined ? '-' : money.format(original.amount)}</td><td className="py-2 text-right tabular-nums">{item.amount === null ? '-' : money.format(item.amount)}</td><td className={`py-2 text-center ${countMatch && amountMatch ? 'text-[var(--tds-green-600)]' : 'text-[var(--tds-red-500)]'}`}>{countMatch && amountMatch ? '일치' : '확인 필요'}</td></tr>; })}</tbody></table></div>}</section>;
}
