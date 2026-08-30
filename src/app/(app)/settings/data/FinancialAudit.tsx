'use client';

import * as XLSX from 'xlsx';
import { useState } from 'react';
import { getFinancialAuditCounts, type FinancialAuditCount } from '@/actions/financial-audit-actions';
import { parseAccountRows } from '@/lib/excel-account-import';
import { parseDepositRows, parseSavingsRows } from '@/lib/excel-savings-import';
import { parseLoanRows, parseInsuranceRows } from '@/lib/excel-loan-insurance-import';
import { parseInvestmentTradeRows } from '@/lib/excel-investment-import';
import { parseAssetRows } from '@/lib/excel-asset-card-import';

type SourceRecord = { name: string; amount: number };
type SourceGroup = { count: number; amount: number; records: SourceRecord[] };
const money = new Intl.NumberFormat('ko-KR');
const sourceKey = (value: string) => value.trim().toLocaleLowerCase();
const allRows = (workbook: XLSX.WorkBook) => workbook.SheetNames.map((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][]);
const first = <T, R extends { errors: string[] }>(groups: T[][], parse: (rows: T[]) => R[]): R[] => groups.map(parse).find((items) => items.length > 0) ?? [];

export function FinancialAudit() {
  const [source, setSource] = useState<Record<string, SourceGroup>>({});
  const [actual, setActual] = useState<FinancialAuditCount[]>([]);
  const [message, setMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  async function handleFile(file: File) {
    setMessage(''); setSource({}); setActual([]); setSelectedKey(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true }); const groups = allRows(workbook);
      const account = first(groups, parseAccountRows); const deposits = first(groups, parseDepositRows); const savings = first(groups, parseSavingsRows); const loans = first(groups, (value) => parseLoanRows(value)); const insurances = first(groups, parseInsuranceRows); const investments = groups.flatMap((value) => parseInvestmentTradeRows(value)); const assets = first(groups, parseAssetRows);
      const valid = <T extends { errors: string[] }>(items: T[]) => items.filter((item) => !item.errors.length);
      const next: Record<string, SourceGroup> = {
        '계좌': { count: valid(account).length, amount: account.reduce((sum, row) => sum + (row.currentBalance ?? 0), 0), records: valid(account).map((row) => ({ name: row.accountName, amount: row.currentBalance ?? 0 })) },
        '예금': { count: valid(deposits).length, amount: deposits.reduce((sum, row) => sum + (row.principal ?? 0), 0), records: valid(deposits).map((row) => ({ name: row.productName, amount: row.principal ?? 0 })) },
        '적금': { count: valid(savings).length, amount: savings.reduce((sum, row) => sum + (row.currentSavings ?? 0), 0), records: valid(savings).map((row) => ({ name: row.productName, amount: row.currentSavings ?? 0 })) },
        '대출': { count: valid(loans).length, amount: loans.reduce((sum, row) => sum + (row.originalAmount ?? 0), 0), records: valid(loans).map((row) => ({ name: row.loanName, amount: row.originalAmount ?? 0 })) },
        '보험': { count: valid(insurances).length, amount: insurances.reduce((sum, row) => sum + (row.monthlyPremium ?? 0), 0), records: valid(insurances).map((row) => ({ name: row.productName, amount: row.monthlyPremium ?? 0 })) },
        '투자거래': { count: valid(investments).length, amount: investments.reduce((sum, row) => sum + (row.settledAmount ?? 0), 0), records: valid(investments).map((row) => ({ name: row.assetName, amount: row.settledAmount ?? 0 })) },
        '기타자산': { count: valid(assets).length, amount: assets.reduce((sum, row) => sum + (row.currentValue ?? 0), 0), records: valid(assets).map((row) => ({ name: row.assetName, amount: row.currentValue ?? 0 })) },
      };
      setSource(next); setActual(await getFinancialAuditCounts());
    } catch (error) { setMessage(error instanceof Error ? error.message : '자산·금융상품 대조에 실패했어요.'); }
  }
  const selected = actual.find((item) => item.key === selectedKey); const sourceRecords = selected ? source[selected.key]?.records ?? [] : []; const sourceNames = new Set(sourceRecords.map((record) => sourceKey(record.name))); const dbOnly = selected?.records.filter((record) => !sourceNames.has(sourceKey(record.name))) ?? [];
  return <section className="tds-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">자산·금융상품 원본 대조</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">Excel 정상 행과 운영 DB의 건수·금액을 비교하고, 항목별 상세 차이를 확인합니다.</p></div><label className="tds-button-secondary inline-flex cursor-pointer px-4"><span>Excel 선택</span><input className="sr-only" type="file" accept=".xlsx,.xls,.xlsm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /></label></div>{message && <p role="alert" className="mt-3 text-sm text-[var(--tds-red-500)]">{message}</p>}{actual.length > 0 && <><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-xs text-[var(--tds-grey-500)]"><th className="py-2 text-left">구분</th><th className="py-2 text-right">원본 건수</th><th className="py-2 text-right">DB 건수</th><th className="py-2 text-right">원본 금액</th><th className="py-2 text-right">DB 금액</th><th className="py-2 text-center">상태</th></tr></thead><tbody>{actual.map((item) => { const original = source[item.key]; const countMatch = original?.count === item.count; const amountMatch = original?.amount === item.amount; return <tr key={item.key} className="border-b border-[var(--tds-grey-100)]"><td className="py-2 font-medium"><button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setSelectedKey(selectedKey === item.key ? null : item.key)}>{item.key}</button></td><td className="py-2 text-right tabular-nums">{original?.count ?? '-'}</td><td className="py-2 text-right tabular-nums">{item.count}</td><td className="py-2 text-right tabular-nums">{original ? money.format(original.amount) : '-'}</td><td className="py-2 text-right tabular-nums">{money.format(item.amount ?? 0)}</td><td className={`py-2 text-center ${countMatch && amountMatch ? 'text-[var(--tds-green-600)]' : 'text-[var(--tds-red-500)]'}`}>{countMatch && amountMatch ? '일치' : '확인 필요'}</td></tr>; })}</tbody></table></div>{selected && <div className="mt-4 rounded-xl bg-[var(--tds-grey-50)] p-4"><h3 className="font-semibold">{selected.key} 상세 차이</h3>{dbOnly.length ? <ul className="mt-2 space-y-1 text-sm">{dbOnly.map((record) => <li key={`${record.name}-${record.amount}`} className="flex justify-between gap-4"><span>{record.name || '이름 없음'}</span><span className="tabular-nums">DB {money.format(record.amount)}원 · 원본 없음</span></li>)}</ul> : <p className="mt-2 text-sm text-[var(--tds-grey-700)]">DB에만 존재하는 항목이 없습니다. 금액 차이는 요약표를 확인하세요.</p>}</div>}</>}</section>;
}
