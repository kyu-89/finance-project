'use client';

import * as XLSX from 'xlsx';
import { useActionState, useMemo, useState } from 'react';
import { importTransactionsAction } from '@/actions/import-actions';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import { mapMonthlySheetRows, type ParsedImportRow } from '@/lib/transaction-import';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

export function WorkbookMonthlyImport({ categories, paymentMethods }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[] }) {
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [state, action, pending] = useActionState(importTransactionsAction, INITIAL_ACTION_STATE);
  const categoryByName = useMemo(() => new Map(categories.map((category) => [category.name.toLocaleLowerCase(), category])), [categories]);
  const parsedValidRows = useMemo(() => rows
    .filter((row) => row.errors.length === 0 && row.transactionDate && row.amount)
    .map((row) => {
      const category = row.categoryName ? categoryByName.get(row.categoryName.toLocaleLowerCase()) : undefined;
      const subcategory = category?.subcategories.find((item) => item.name.toLocaleLowerCase() === row.subcategoryName?.toLocaleLowerCase());
      const paymentMethod = row.cardLabel ? paymentMethods.find((method) => method.name.toLocaleLowerCase() === row.cardLabel!.toLocaleLowerCase()) : undefined;
      return {
        transactionDate: row.transactionDate as string,
        sourceMonth: row.sourceMonth ?? null,
        transactionType: row.transactionType,
        amount: row.amount as number,
        description: row.description,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        paymentMethodId: row.transactionType === 'income' ? null : paymentMethod?.id ?? paymentMethodId,
        memo: row.memo ?? `Excel 월별 가져오기: ${fileName}`,
        needsReview: Boolean(row.categoryName && !category) || Boolean(row.subcategoryName && !subcategory) || Boolean(row.cardLabel && !paymentMethod),
      };
    }), [rows, categoryByName, paymentMethodId, paymentMethods, fileName]);
  const validRows = useMemo(() => {
    const seen = new Set<string>();
    return parsedValidRows.filter((row) => {
      const key = `${row.sourceMonth ?? ''}|${row.transactionDate}|${row.transactionType}|${row.amount}|${row.description.trim().toLocaleLowerCase()}|${row.paymentMethodId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [parsedValidRows]);
  const duplicateRows = parsedValidRows.length - validRows.length;
  const sourceMonthCounts = useMemo(() => Array.from(rows.reduce((counts, row) => {
    if (row.sourceMonth && row.errors.length === 0) counts.set(row.sourceMonth, (counts.get(row.sourceMonth) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries()).sort(([a], [b]) => a.localeCompare(b)), [rows]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setRows([]);
    setMessage('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true });
      const monthly = workbook.SheetNames.filter((name) => /^(?:[1-9]|1[0-2])월$/.test(name));
      const year = file.name.match(/20\d{2}/)?.[0] ?? String(new Date().getFullYear());
      const parsed = monthly.flatMap((name) => mapMonthlySheetRows(
        XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][],
        `${year}-${String(Number(name.replace('월', ''))).padStart(2, '0')}`,
      ));
      if (!parsed.length) setMessage('1월~12월 시트에서 거래 표를 찾지 못했습니다.');
      setRows(parsed);
    } catch {
      setMessage('Excel 파일을 읽지 못했습니다.');
    }
  }

  return <section className="tds-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">월별 거래 전체 가져오기</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">1월~12월 시트를 한 번에 읽어 거래 원장에 추가합니다.</p></div><label className="tds-button-secondary inline-flex cursor-pointer px-4"><span>Excel 파일 선택</span><input className="sr-only" type="file" accept=".xlsx,.xls,.xlsm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /></label></div>
    {message && <p role="alert" className="mt-3 text-sm text-[var(--tds-red-500)]">{message}</p>}
    {rows.length > 0 && <><div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p>원본 행 <strong>{rows.length}건</strong></p><p>가져오기 대상 <strong>{validRows.length}건</strong></p><p>오류 <strong>{rows.length - parsedValidRows.length}건</strong></p></div><p className="mt-2 text-xs text-[var(--tds-grey-600)]">파일 내 중복 {duplicateRows}건은 한 번만 반영합니다. 기존 DB 중복은 서버에서 추가로 확인합니다.</p><div className="mt-3 flex flex-wrap gap-2">{sourceMonthCounts.map(([month, count]) => <span key={month} className="tds-chip">{month}: {count}건</span>)}</div><FormMessage result={state} /><form action={action}><input type="hidden" name="rows" value={JSON.stringify(validRows)} /><button disabled={pending || !paymentMethodId || !validRows.length} className="tds-primary-button mt-4 w-full">{pending ? '가져오는 중…' : `${validRows.length}건 가져오기`}</button></form></>}
  </section>;
}
