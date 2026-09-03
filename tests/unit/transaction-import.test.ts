import { describe, expect, it } from 'vitest';
import { detectMapping, findHeaderRow, mapImportRows, normalizeImportAmount, normalizeImportDate } from '@/lib/transaction-import';

describe('transaction import normalization', () => {
  it('detects common Korean card headers with variations', () => {
    expect(detectMapping(['승인 일시', '이용금액(원)', '가맹점명', '취소구분'])).toMatchObject({ date: '승인 일시', amount: '이용금액(원)', description: '가맹점명', status: '취소구분' });
  });

  it('finds a header below issuer title rows', () => {
    const found = findHeaderRow([['신한카드 이용내역'], ['조회기간', '2026'], ['이용일', '가맹점', '이용금액']]);
    expect(found?.rowIndex).toBe(2);
  });

  it('normalizes Excel serial and Korean date strings without local timezone drift', () => {
    expect(normalizeImportDate(46000)).toBe('2025-12-09');
    expect(normalizeImportDate('2026. 8. 29.')).toBe('2026-08-29');
    expect(normalizeImportDate('20260829')).toBe('2026-08-29');
    expect(normalizeImportDate('2026-02-30')).toBeNull();
  });

  it('parses currency signs, commas, and negative refunds', () => {
    expect(normalizeImportAmount('₩-12,345')).toEqual({ amount: 12345, negative: true });
    expect(normalizeImportAmount('(8,000원)')).toEqual({ amount: 8000, negative: true });
    expect(normalizeImportAmount('8,000-')).toEqual({ amount: 8000, negative: true });
  });

  it('maps rows and marks cancellation as refund while preserving row errors', () => {
    const rows = mapImportRows([
      ['이용일', '가맹점', '승인금액', '승인상태'],
      ['2026-08-29', '카페', '12,000', '정상'],
      ['2026-08-30', '', '-3,000', '승인취소'],
    ], ['이용일', '가맹점', '승인금액', '승인상태'], { date: '이용일', amount: '승인금액', description: '가맹점', status: '승인상태' });
    expect(rows[0]).toMatchObject({ transactionDate: '2026-08-29', amount: 12000, transactionType: 'expense', errors: [] });
    expect(rows[1]).toMatchObject({ amount: 3000, transactionType: 'refund', errors: ['가맹점/내용이 비어 있어요.'] });
  });

  it('maps income rows from a type/status column without requiring a payment method', () => {
    const rows = mapImportRows([
      ['date', 'description', 'amount', 'type'],
      ['2026-08-29', 'Salary', '3000000', 'income'],
    ], ['date', 'description', 'amount', 'type'], { date: 'date', description: 'description', amount: 'amount', status: 'type' });
    expect(rows[0]).toMatchObject({ transactionType: 'income', amount: 3000000, errors: [] });
  });

  // 2026-09: 참고 거래(사용자 지시 §5) — 상태/구분 컬럼과 카테고리 둘 다 완전히 비어 있는 행만
  // 참고 거래로 본다. 카드 대납·현금 환급처럼 원본에 수입/지출 신호가 전혀 없는 행을 위한 규칙.
  it('marks a row with no status and no category as a reference transaction', () => {
    const rows = mapImportRows([
      ['이용일', '가맹점', '승인금액', '승인상태', '카테고리'],
      ['2026-08-29', '엄마 대신 결제', '50,000', '', ''],
    ], ['이용일', '가맹점', '승인금액', '승인상태', '카테고리'], { date: '이용일', amount: '승인금액', description: '가맹점', status: '승인상태', category: '카테고리' });
    expect(rows[0]).toMatchObject({ transactionType: 'reference', amount: 50000, errors: [] });
  });

  // 회귀 가드: 상태 컬럼에 인식 못 하는 값이라도 뭔가 들어있으면(빈 값이 아니면) 여전히 지출로
  // 본다 — "구분이 없는" 행만 참고 거래가 되어야 하고, 그냥 카테고리가 안 붙은 정상 지출까지
  // 참고 거래로 잘못 분류되면 안 된다.
  it('still treats a row with an unrecognized (non-empty) status as an ordinary expense', () => {
    const rows = mapImportRows([
      ['이용일', '가맹점', '승인금액', '승인상태'],
      ['2026-08-29', '커피', '3,000', '정상'],
    ], ['이용일', '가맹점', '승인금액', '승인상태'], { date: '이용일', amount: '승인금액', description: '가맹점', status: '승인상태' });
    expect(rows[0]).toMatchObject({ transactionType: 'expense', amount: 3000, errors: [] });
  });
});
