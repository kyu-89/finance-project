'use client';
import * as XLSX from 'xlsx';
import { useActionState, useMemo, useState } from 'react';
import { importLoansAction } from '@/actions/finance-product-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { parseLoanRows, type ParsedLoan } from '@/lib/excel-loan-insurance-import';

export function LoanImport() {
  const [rows, setRows] = useState<ParsedLoan[]>([]);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [state, action, pending] = useActionState(importLoansAction, INITIAL_ACTION_STATE);
  const valid = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows]);

  async function handleFile(file: File) {
    setFileName(file.name); setRows([]); setMessage('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true });
      const parsed = workbook.SheetNames.flatMap((name) => {
        if (name !== '대출' && name !== '대환_상환완료건') return [];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][];
        return parseLoanRows(rows, name === '대환_상환완료건' ? 'refinanced' : 'active');
      });
      if (!parsed.length) { setMessage('대출 또는 대환·상환완료건 시트를 찾지 못했습니다.'); return; }
      setRows(parsed);
    } catch { setMessage('Excel 파일을 읽지 못했습니다.'); }
  }

  return <section className="tds-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">대출 Excel 가져오기</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">대출 상품, 대환·상환완료 상품, 각 상품의 상환내역을 함께 미리 확인합니다.</p></div><label className="tds-button-secondary inline-flex cursor-pointer"><span>Excel 파일 선택</span><input className="sr-only" type="file" accept=".xlsx,.xls,.xlsm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /></label></div>
    {fileName && <p className="mt-3 text-sm">선택 파일: <strong>{fileName}</strong></p>}
    {message && <p role="alert" className="mt-3 text-sm text-[var(--tds-red-500)]">{message}</p>}
    {rows.length > 0 && <><p className="mt-4 text-sm">총 {rows.length}건 · 등록 가능 {valid.length}건 · 상환내역 {valid.reduce((sum, row) => sum + row.payments.length, 0)}건 · 오류 {rows.length - valid.length}건</p><FormMessage result={state} /><form action={action}><input type="hidden" name="loans" value={JSON.stringify(valid)} /><button disabled={pending || valid.length === 0} className="tds-primary-button mt-4 w-full">{pending ? '가져오는 중…' : `${valid.length}건 가져오기`}</button></form></>}
  </section>;
}
