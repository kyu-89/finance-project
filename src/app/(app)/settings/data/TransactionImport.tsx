'use client';

import * as XLSX from 'xlsx';
import { useActionState, useMemo, useState } from 'react';
import { importTransactionsAction } from '@/actions/import-actions';
import { FormField } from '@/components/FormField';
import { FormMessage } from '@/components/FormMessage';
import { INITIAL_ACTION_STATE } from '@/lib/action-result';
import type { Category } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import { detectMapping, findHeaderRow, mapImportRows, type ImportField, type ImportMapping, type ParsedImportRow } from '@/lib/transaction-import';

type SheetData = { name: string; rows: unknown[][] };
const fields: { key: ImportField; label: string; required?: boolean }[] = [
  { key: 'date', label: '날짜', required: true }, { key: 'amount', label: '금액', required: true }, { key: 'description', label: '가맹점/내용', required: true },
  { key: 'status', label: '취소·환불 구분' }, { key: 'category', label: '카테고리' }, { key: 'memo', label: '메모/할부' }, { key: 'card', label: '카드명' },
];
const won = new Intl.NumberFormat('ko-KR');

export function TransactionImport({ categories, paymentMethods }: { categories: Category[]; paymentMethods: PaymentMethod[] }) {
  const [fileName, setFileName] = useState(''); const [sheets, setSheets] = useState<SheetData[]>([]); const [sheetName, setSheetName] = useState(''); const [headerIndex, setHeaderIndex] = useState(0); const [headers, setHeaders] = useState<string[]>([]); const [mapping, setMapping] = useState<ImportMapping>({}); const [parseMessage, setParseMessage] = useState(''); const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? ''); const [fallbackCategoryId, setFallbackCategoryId] = useState(''); const [state, action, pending] = useActionState(importTransactionsAction, INITIAL_ACTION_STATE);
  const selectedSheet = sheets.find((sheet) => sheet.name === sheetName); const parsedRows = useMemo(() => selectedSheet ? mapImportRows(selectedSheet.rows, headers, mapping, headerIndex) : [], [selectedSheet, headers, mapping, headerIndex]);
  const categoryByName = useMemo(() => new Map(categories.map((category) => [category.name.trim().toLocaleLowerCase(), category.id])), [categories]);
  // 참고 거래(row.transactionType === 'reference')는 원본에 수입/지출 신호와 카테고리가 둘 다
  // 없던 행이다(사용자 지시 §5) — 대분류를 억지로 채우지 않고(fallbackCategoryId도 적용 안 함)
  // null로 저장하며, 그 이유만으로 검토 필요 상태를 유지하지 않는다(§9).
  const importableRows = useMemo(() => parsedRows.filter((row) => row.errors.length === 0 && row.transactionDate && row.amount).map((row) => ({ transactionDate: row.transactionDate as string, transactionType: (row.transactionType === 'refund' ? 'expense' : row.transactionType) as 'income' | 'expense' | 'reference', status: (row.transactionType === 'refund' ? 'refunded' : 'posted') as 'posted' | 'refunded', amount: row.amount as number, description: row.description, categoryId: row.transactionType === 'reference' ? null : row.categoryName ? (categoryByName.get(row.categoryName.toLocaleLowerCase()) ?? fallbackCategoryId ?? null) : (fallbackCategoryId || null), paymentMethodId: row.transactionType === 'income' ? null : paymentMethodId, memo: row.memo ?? `엑셀 가져오기: ${fileName}`, needsReview: row.transactionType === 'reference' ? false : (!row.categoryName || !categoryByName.has(row.categoryName.toLocaleLowerCase())) })), [parsedRows, categoryByName, fallbackCategoryId, paymentMethodId, fileName]);
  const invalidCount = parsedRows.filter((row) => row.errors.length > 0).length; const referenceCount = parsedRows.filter((row) => row.errors.length === 0 && row.transactionType === 'reference').length; const categoryUnmatchedCount = parsedRows.filter((row) => row.errors.length === 0 && row.transactionType === 'expense' && row.categoryName && !categoryByName.has(row.categoryName.toLocaleLowerCase()) && !fallbackCategoryId).length; const requiresPaymentMethod = importableRows.some((row) => row.transactionType !== 'income');

  async function handleFile(file: File) {
    setParseMessage(''); setFileName(file.name); setSheets([]); setSheetName('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true });
      const nextSheets = workbook.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][] }));
      const first = nextSheets.map((sheet) => ({ sheet, found: findHeaderRow(sheet.rows) })).filter((entry) => entry.found).sort((a, b) => (b.found ? b.found.mapping ? Object.keys(b.found.mapping).length : 0 : 0) - (a.found ? Object.keys(a.found.mapping).length : 0))[0];
      if (!first?.found) { setParseMessage('거래 날짜·금액·가맹점 열을 찾지 못했어요. 다른 시트를 선택하거나 직접 열을 지정해 주세요.'); setSheets(nextSheets); setSheetName(nextSheets[0]?.name ?? ''); return; }
      setSheets(nextSheets); setSheetName(first.sheet.name); applyHeader(first.sheet, first.found.rowIndex);
    } catch { setParseMessage('파일을 읽지 못했어요. 카드사에서 내려받은 XLS, XLSX, CSV 파일인지 확인해 주세요.'); }
  }

  function applyHeader(sheet: SheetData, rowIndex: number) { const nextHeaders = sheet.rows[rowIndex]?.map((value) => String(value ?? '').trim()) ?? []; setHeaderIndex(rowIndex); setHeaders(nextHeaders); setMapping(detectMapping(nextHeaders)); }
  function selectSheet(name: string) { const sheet = sheets.find((item) => item.name === name); if (!sheet) return; setSheetName(name); const found = findHeaderRow(sheet.rows); applyHeader(sheet, found?.rowIndex ?? 0); }
  function updateMapping(field: ImportField, value: string) { setMapping((current) => ({ ...current, [field]: value || undefined })); }

  return <div className="flex flex-col gap-5">
    <section className="tds-card p-5"><h2 className="text-lg font-bold">1. 파일 선택</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">카드사·은행 홈페이지에서 받은 원본 파일을 그대로 올려도 돼요. 파일은 서버에 보관하지 않고 거래로 변환해요.</p><label className="tds-button-secondary mt-4 inline-flex cursor-pointer px-4"><span>Excel·CSV 파일 선택</span><input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /></label>{fileName && <p className="mt-3 text-sm">선택한 파일: <strong>{fileName}</strong></p>}{parseMessage && <p role="alert" className="mt-3 rounded-xl bg-[oklch(0.96_0.025_22)] px-4 py-3 text-sm text-[var(--tds-red-500)]">{parseMessage}</p>}</section>
    {sheets.length > 1 && <section className="tds-card p-5"><FormField label="가져올 시트"><select className="tds-input" value={sheetName} onChange={(event) => selectSheet(event.target.value)}>{sheets.map((sheet) => <option key={sheet.name}>{sheet.name}</option>)}</select></FormField></section>}
    {headers.length > 0 && <>
      <section className="tds-card p-5"><h2 className="text-lg font-bold">2. 열 확인</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">카드사마다 열 이름이 달라 자동으로 연결했어요. 맞지 않는 열만 바꿔 주세요.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map((field) => <FormField key={field.key} label={field.label} required={field.required}><select className="tds-input" value={mapping[field.key] ?? ''} onChange={(event) => updateMapping(field.key, event.target.value)}><option value="">선택 안 함</option>{headers.map((header, index) => <option key={`${header}-${index}`} value={header}>{header || `(열 ${index + 1})`}</option>)}</select></FormField>)}</div></section>
      <section className="tds-card p-5"><h2 className="text-lg font-bold">3. 저장 방식</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><FormField label="결제수단"><select className="tds-input" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}><option value="">선택해 주세요</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></FormField><FormField label="카테고리 열이 없거나 인식되지 않을 때"><select className="tds-input" value={fallbackCategoryId} onChange={(event) => setFallbackCategoryId(event.target.value)}><option value="">미분류로 남기기</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField></div><p className="mt-3 text-xs leading-5 text-[var(--tds-grey-500)]">카테고리를 정하지 않은 거래는 나중에 분류할 수 있도록 ‘확인 필요’로 표시해요. 같은 날짜·금액·가맹점·결제수단의 거래는 다시 올려도 중복 저장하지 않아요.</p></section>
      <section className="tds-card p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold">4. 가져올 내역 미리보기</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">정상 {parsedRows.length - invalidCount - referenceCount}건 · 참고 거래 {referenceCount}건 · 확인 필요 {categoryUnmatchedCount}건 · 읽지 못한 행 {invalidCount}건</p></div><span className="text-sm font-semibold">총 {parsedRows.length}건</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-[var(--tds-grey-200)] text-xs text-[var(--tds-grey-500)]"><th className="px-2 py-2">행</th><th className="px-2 py-2">날짜</th><th className="px-2 py-2">구분</th><th className="px-2 py-2">가맹점/내용</th><th className="px-2 py-2 text-right">금액</th><th className="px-2 py-2">카테고리</th><th className="px-2 py-2">상태</th></tr></thead><tbody>{parsedRows.slice(0, 30).map((row) => <PreviewRow key={row.rowNumber} row={row} categoryByName={categoryByName} fallbackCategoryId={fallbackCategoryId} categories={categories} />)}</tbody></table></div>{parsedRows.length > 30 && <p className="mt-3 text-xs text-[var(--tds-grey-500)]">처음 30건만 보여드려요. 전체 {parsedRows.length}건이 저장 대상이에요.</p>}{state.ok !== null && <div className="mt-4"><FormMessage result={state} successMessage="거래를 가져왔어요." /></div>}<form action={action}><input type="hidden" name="rows" value={JSON.stringify(importableRows)} /><button disabled={pending || (requiresPaymentMethod && !paymentMethodId) || importableRows.length === 0} className="tds-primary-button mt-5 w-full px-5">{pending ? '거래를 저장하는 중...' : `${importableRows.length}건 가져오기`}</button></form></section>
    </>}
    {paymentMethods.length === 0 && <p className="rounded-xl bg-[var(--tds-blue-50)] px-4 py-3 text-sm">먼저 설정에서 카드나 결제수단을 등록해 주세요.</p>}
  </div>;
}

const TYPE_LABEL: Record<ParsedImportRow['transactionType'], string> = { income: '수입', expense: '소비', refund: '환불·취소', reference: '참고 거래' };
function PreviewRow({ row, categoryByName, fallbackCategoryId, categories }: { row: ParsedImportRow; categoryByName: Map<string, string>; fallbackCategoryId: string; categories: Category[] }) {
  const isReference = row.transactionType === 'reference';
  const category = isReference ? null : row.categoryName ? categories.find((item) => item.id === categoryByName.get(row.categoryName!.toLocaleLowerCase()))?.name : fallbackCategoryId ? categories.find((item) => item.id === fallbackCategoryId)?.name : null;
  return <tr className="border-b border-[var(--tds-grey-100)]"><td className="px-2 py-2 text-[var(--tds-grey-500)]">{row.rowNumber}</td><td className="px-2 py-2 tabular-nums">{row.transactionDate ?? '-'}</td><td className="px-2 py-2">{TYPE_LABEL[row.transactionType]}</td><td className="max-w-64 truncate px-2 py-2">{row.description || '-'}</td><td className="px-2 py-2 text-right tabular-nums">{row.amount === null ? '-' : `${won.format(row.amount)}원`}</td><td className="px-2 py-2">{isReference ? '대분류·소분류 없음' : (category ?? '미분류')}</td><td className="px-2 py-2 text-xs">{row.errors.length ? <span className="text-[var(--tds-red-500)]">{row.errors.join(' ')}</span> : isReference ? <span className="text-[var(--tds-grey-500)]">참고 거래 · 수입·지출 집계 제외 · 결제수단 분석엔 포함</span> : row.transactionType === 'expense' && !category ? <span className="text-[var(--tds-grey-500)]">확인 필요</span> : '가져옴'}</td></tr>;
}
