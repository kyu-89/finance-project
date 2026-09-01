import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAccountRows } from '@/lib/excel-account-import';
import { parseInvestmentTradeRows } from '@/lib/excel-investment-import';
import { parseDepositRows, parseSavingsRows } from '@/lib/excel-savings-import';
import { parseInsuranceRows, parseLoanRows } from '@/lib/excel-loan-insurance-import';
import { parseEventRows, parseSupportRows } from '@/lib/excel-support-event-import';
import { parsePlanningRows } from '@/lib/excel-planning-import';
import { mapMonthlySheetRows } from '@/lib/transaction-import';

const workbookPath = 'C:/Users/미니쉬테크놀로지-김규남/Desktop/dev/personal-finance/2026년 (1).xlsm';
const rows = (workbook: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][];

describe('2026 workbook parser audit', () => {
  it('extracts every supported structured sheet without parser crashes', () => {
    const workbook = XLSX.readFile(workbookPath, { cellDates: true });
    expect(parseAccountRows(rows(workbook, '계좌현황')).length).toBeGreaterThan(0);
    expect(parseDepositRows(rows(workbook, '예금관리')).length).toBeGreaterThan(0);
    expect(parseSavingsRows(rows(workbook, '적금관리')).length).toBeGreaterThan(0);
    expect(parseLoanRows(rows(workbook, '대출')).length).toBeGreaterThan(0);
    expect(parseInsuranceRows(rows(workbook, '보험')).length).toBeGreaterThan(0);
    expect(parseInvestmentTradeRows(rows(workbook, '업비트수익')).length + parseInvestmentTradeRows(rows(workbook, '업비트2')).length).toBeGreaterThan(0);
    expect(parseSupportRows(rows(workbook, '정부지원금')).length).toBeGreaterThan(0);
    expect(parseEventRows(rows(workbook, '축의금&부조금')).length).toBeGreaterThan(0);
  });

  it('keeps the source workbook year for planning dates', () => {
    const result = parsePlanningRows([['', '', '', '2026년 주택자금', '', '', '', '', '', '2026년 6월 점검']], 2026);
    expect(result.goals[0]?.goalYear).toBe(2026);
    expect(result.tasks[0]?.taskDate).toBe('2026-06-30');
  });

  it('maps the side-by-side monthly income and expense tables without parser errors', () => {
    const parsed = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
      .flatMap((name) => mapMonthlySheetRows(rows(XLSX.readFile(workbookPath, { cellDates: true }), name), `2026-${String(Number(name.replace('월', ''))).padStart(2, '0')}`));
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.filter((row) => row.errors.length > 0)).toEqual([]);
    expect(parsed.some((row) => row.categoryName === '수입' && row.subcategoryName === '급여')).toBe(true);
    expect(parsed.some((row) => row.categoryName === '식비' && row.subcategoryName === '외식')).toBe(true);
    expect(parsed.filter((row) => row.sourceMonth === '2026-08').length).toBeGreaterThan(0);
  });
});
