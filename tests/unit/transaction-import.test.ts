import { describe, expect, it } from 'vitest';
import { detectMapping, findHeaderRow, mapImportRows, mapMonthlySheetRows, normalizeImportAmount, normalizeImportDate } from '@/lib/transaction-import';

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

  it('maps a subcategory column without losing the source label', () => {
    const rows = mapImportRows([
      ['date', 'description', 'amount', 'type', 'subcategory'],
      ['2026-08-29', 'Salary', '3000000', 'income', '급여'],
    ], ['date', 'description', 'amount', 'type', 'subcategory'], { date: 'date', description: 'description', amount: 'amount', status: 'type', subcategory: 'subcategory' });
    expect(rows[0]).toMatchObject({ transactionType: 'income', subcategoryName: '급여', errors: [] });
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

describe('mapMonthlySheetRows', () => {
  // 회귀 가드: 원본 워크북에서 "부가수입" 구역의 헤더 바로 다음 행에 "소비성지출" 구역의
  // 헤더가 오는 달이 실제로 여러 번 있었다 — 예전 코드는 경계를 "종류 상관없이 다음 헤더
  // 행"으로 계산해서, 이 경우 부가수입의 데이터 범위가 [헤더+1, 헤더+1) = 0행으로 붕괴해
  // 그 달의 부가수입 전체가 에러 없이 통째로 사라졌다(2026년 1·2·6·7·8·9·10·11·12월 등에서
  // 실제로 재현됨). income/expense 블록은 시트에서 서로 다른 열 범위를 쓰므로, 경계는 "같은
  // 종류의 다음 헤더 행"이어야 한다.
  it('does not drop the second income block even when a different-kind header lands on the very next row', () => {
    const rows = [
      // row0: 고정수입 헤더(col0) + 저축성지출 헤더(col6)
      ['날짜', '대분류', '소분류', '내용', '금액', '', '날짜', '구분', '대분류', '소분류', '지출내용', '지출', '납입금액', '비고'],
      // row1: 고정수입 데이터 + 저축성지출 데이터
      ['2026-01-05', '수입', '급여', '급여', 1_000_000, '', '2026-01-05', '카드', '저축성지출', '예/적금', '적금', 200_000, '', ''],
      // row2: 부가수입 헤더(col0) — 소비성지출 헤더가 바로 다음 행(row3)에 옴(충돌 재현 조건)
      ['날짜', '대분류', '소분류', '내용', '금액', '', '', '', '', '', '', '', '', ''],
      // row3: 부가수입 데이터(col0) + 소비성지출 헤더(col6, 이 행과 겹침)
      ['2026-01-10', '수입', '이자', '이자수익', 50_000, '', '날짜', '구분', '대분류', '소분류', '지출내용', '지출', '납입금액', '비고'],
      // row4: 부가수입 데이터 + 소비성지출 데이터
      ['2026-01-15', '수입', '기타 수입', '기타수입', 30_000, '', '2026-01-11', '카드', '식비', '외식', '저녁', 20_000, '', ''],
    ];
    const parsed = mapMonthlySheetRows(rows, '2026-01');
    const income = parsed.filter((row) => row.transactionType === 'income');
    // 고정수입(급여) + 부가수입(이자수익, 기타수입) 3건 모두 잡혀야 한다 — 버그가 있었다면
    // 부가수입 2건이 통째로 사라져 income.length가 1이 된다.
    expect(income).toHaveLength(3);
    expect(income.reduce((sum, row) => sum + (row.amount ?? 0), 0)).toBe(1_080_000);
    expect(income.map((row) => row.description)).toEqual(['급여', '이자수익', '기타수입']);

    const expense = parsed.filter((row) => row.transactionType === 'expense');
    expect(expense).toHaveLength(2);
    expect(expense.map((row) => row.categoryName)).toEqual(['저축성지출', '식비']);
  });

  // 회귀 가드: 고정수입 구역에 내용↔금액이 뒤바뀌어 입력된 행("내용"에 숫자, "금액"에
  // "의료비사용"/"주유비사용" 같은 텍스트)은 되살려 넣지 않고 아예 건너뛴다(사용자 지시:
  // "이건 그냥 금액없이 불러와. 수입에 계산되면 안돼").
  it('skips an income row whose amount cell holds descriptive text instead of a number', () => {
    const rows = [
      ['날짜', '대분류', '소분류', '내용', '금액'],
      ['2026-01-05', '수입', '기타 수입', '15', '의료비사용'],
      ['2026-01-06', '수입', '기타 수입', '기타수입', 10_000],
    ];
    const parsed = mapMonthlySheetRows(rows, '2026-01');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ description: '기타수입', amount: 10_000 });
  });
});
