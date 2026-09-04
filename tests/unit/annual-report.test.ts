import { describe, expect, it } from 'vitest';
import {
  buildAnnualCardReport,
  buildAnnualExpenseCategoryReport,
  buildAnnualExpenseDetailReport,
  buildAnnualIncomeReport,
} from '@/lib/annual-report';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

const MONTHS = ['2026-01', '2026-02'];

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    householdId: 'h1',
    transactionDate: '2026-01-15',
    sourceMonth: null,
    transactionType: 'expense',
    flowClass: 'consumption',
    costBehavior: null,
    paymentMethodId: null,
    categoryId: null,
    subcategoryId: null,
    amount: 10_000,
    description: '',
    memo: null,
    tags: [],
    includeInBudget: true,
    needsReview: false,
    recurringRuleId: null,
    recurringOccurrenceId: null,
    status: 'posted',
    ...overrides,
  };
}

function category(overrides: Partial<CategoryWithSubcategories>): CategoryWithSubcategories {
  return {
    id: 'cat',
    householdId: 'h1',
    transactionType: 'expense',
    name: '카테고리',
    defaultCostBehavior: null,
    isActive: true,
    subcategories: [],
    ...overrides,
  };
}

function paymentMethod(overrides: Partial<PaymentMethod>): PaymentMethod {
  return {
    id: 'pm',
    householdId: 'h1',
    name: '결제수단',
    methodType: 'credit_card',
    isActive: true,
    providerName: null,
    accountNumber: null,
    cardNumberLast4: null,
    expiresAt: null,
    ...overrides,
  };
}

// 2026-09(사용자 지시: "엑셀 그대로의 구조로 보고싶어") — 연간_항목별수입/연간_카드별지출/
// 연간_항목별지출/연간_세부항목별지출의 실제 셀 값을 역산해 검증한 규칙을 그대로 테스트한다.
describe('buildAnnualIncomeReport', () => {
  const incomeCategory = category({
    id: 'cat-income', transactionType: 'income', name: '수입',
    subcategories: [
      { id: 'sub-carry', categoryId: 'cat-income', name: '이월', isActive: true },
      { id: 'sub-salary', categoryId: 'cat-income', name: '급여', isActive: true },
      { id: 'sub-allowance', categoryId: 'cat-income', name: '수당', isActive: true },
      { id: 'sub-bonus', categoryId: 'cat-income', name: '상여', isActive: true },
      { id: 'sub-investment', categoryId: 'cat-income', name: '투자수익', isActive: true },
      { id: 'sub-interest', categoryId: 'cat-income', name: '이자', isActive: true },
      { id: 'sub-side', categoryId: 'cat-income', name: '부수익', isActive: true },
      { id: 'sub-disposal', categoryId: 'cat-income', name: '처분소득', isActive: true },
      { id: 'sub-etc', categoryId: 'cat-income', name: '기타 수입', isActive: true },
    ],
  });

  it('excludes 이월, splits 주소득/부소득 by subcategory name, and checksums ratios to ~1', () => {
    const transactions = [
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-carry', amount: 999_999 }), // 이월 — must not appear anywhere
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-salary', amount: 4_838_940 }),
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-allowance', amount: 600_000 }),
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-investment', amount: 110_859 }),
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-interest', amount: 139_214 }),
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-side', amount: 525_940 }),
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-disposal', amount: 885_200 }),
      tx({ transactionType: 'income', flowClass: 'cash_in', subcategoryId: 'sub-etc', amount: 829_934 }),
    ];
    const rows = buildAnnualIncomeReport(transactions, MONTHS, incomeCategory);

    expect(rows.find((r) => r.id === 'sub-carry')).toBeUndefined();
    const primary = rows.find((r) => r.id === 'income-primary-subtotal')!;
    const secondary = rows.find((r) => r.id === 'income-secondary-subtotal')!;
    const total = rows.find((r) => r.id === 'income-total')!;
    // 실제 2026년 1월 엑셀 값과 동일 — 급여+수당+상여만 주소득.
    expect(primary.monthly[0]).toBe(5_438_940);
    expect(secondary.monthly[0]).toBe(2_491_147);
    expect(total.monthly[0]).toBe(7_930_087);

    const primaryRatio = rows.find((r) => r.id === 'income-primary-ratio')!;
    const secondaryRatio = rows.find((r) => r.id === 'income-secondary-ratio')!;
    const checksum = rows.find((r) => r.id === 'income-checksum')!;
    expect(primaryRatio.kind).toBe('ratio');
    expect(primaryRatio.monthly[0]).toBeCloseTo(5_438_940 / 7_930_087, 10);
    expect(checksum.kind).toBe('checksum');
    expect(checksum.monthly[0]).toBeCloseTo(1, 10);
    expect(secondaryRatio.monthly[1]).toBe(0); // 2월 데이터 없음 → 분모 0 → 0으로 안전 처리
  });
});

describe('buildAnnualCardReport', () => {
  const methods = [
    paymentMethod({ id: 'pm-transfer', name: '계좌이체', methodType: 'account_transfer' }),
    paymentMethod({ id: 'pm-cash', name: '현금', methodType: 'cash' }),
    paymentMethod({ id: 'pm-credit', name: '신한신용', methodType: 'credit_card' }),
    paymentMethod({ id: 'pm-check', name: '국민체크', methodType: 'check_card' }),
    paymentMethod({ id: 'pm-voucher', name: '성북사랑상품권', methodType: 'other' }),
  ];

  it('includes every payment method type (계좌이체/현금/상품권 포함) and excludes 계좌이체 only from 소비 계', () => {
    const transactions = [
      tx({ paymentMethodId: 'pm-transfer', amount: 8_525_154 }),
      tx({ paymentMethodId: 'pm-cash', amount: 105_000 }),
      tx({ paymentMethodId: 'pm-credit', amount: 259_620 }),
      tx({ paymentMethodId: 'pm-check', transactionType: 'reference', flowClass: 'excluded', amount: 18_867 }), // 참고 거래도 카드 사용액엔 포함
      tx({ paymentMethodId: 'pm-voucher', amount: 52_954 }), // 원본 엑셀 수식이 빠뜨렸던 항목 — 여기서는 반드시 포함
    ];
    const rows = buildAnnualCardReport(transactions, MONTHS, methods);

    expect(rows.find((r) => r.id === 'pm-voucher')!.monthly[0]).toBe(52_954);
    const grandTotal = rows.find((r) => r.id === 'card-grand-total')!;
    expect(grandTotal.monthly[0]).toBe(8_525_154 + 105_000 + 259_620 + 18_867 + 52_954);
    const checkVoucherSubtotal = rows.find((r) => r.id === 'card-check-voucher-subtotal')!;
    expect(checkVoucherSubtotal.monthly[0]).toBe(18_867 + 52_954); // check_card+other(상품권) 모두 포함
    const consumption = rows.find((r) => r.id === 'card-consumption-subtotal')!;
    // 소비 계 = 현금+신용카드+체크카드/상품권 (계좌이체 제외)
    expect(consumption.monthly[0]).toBe(105_000 + 259_620 + 18_867 + 52_954);
    expect(consumption.monthly[0]).not.toBe(grandTotal.monthly[0]);
  });
});

describe('buildAnnualExpenseCategoryReport', () => {
  const categories = [
    category({ id: 'cat-savings', name: '저축성지출' }),
    category({ id: 'cat-food', name: '식비' }),
    category({ id: 'cat-housing', name: '주거비' }),
    category({ id: 'cat-uncategorized', name: '미분류' }), // 폴백 카테고리 — 행에 나타나면 안 됨
  ];

  it('computes 소비성지출 as a synthetic subtotal and rates each category against it (not against 총계)', () => {
    const transactions = [
      tx({ categoryId: 'cat-savings', amount: 6_472_800 }),
      tx({ categoryId: 'cat-food', amount: 472_301 }),
      tx({ categoryId: 'cat-housing', amount: 196_270 }),
      tx({ categoryId: 'cat-uncategorized', amount: 123_456 }), // 폴백 — 소비성지출 계산엔 포함되지만 자체 행은 없음
    ];
    const rows = buildAnnualExpenseCategoryReport(transactions, MONTHS, categories);

    expect(rows.find((r) => r.label === '미분류')).toBeUndefined();
    const savingsRow = rows.find((r) => r.id === 'cat-savings')!;
    expect(savingsRow.kind).toBe('item');
    expect(savingsRow.monthly[0]).toBe(6_472_800);
    const consumption = rows.find((r) => r.id === 'expense-consumption-subtotal')!;
    expect(consumption.kind).toBe('subtotal');
    expect(consumption.monthly[0]).toBe(472_301 + 196_270 + 123_456);
    const total = rows.find((r) => r.id === 'expense-total')!;
    expect(total.monthly[0]).toBe(6_472_800 + 472_301 + 196_270 + 123_456);

    const foodRatio = rows.find((r) => r.id === 'cat-food-ratio')!;
    expect(foodRatio.kind).toBe('ratio');
    expect(foodRatio.monthly[0]).toBeCloseTo(472_301 / consumption.monthly[0], 10);
    expect(foodRatio.monthly[0]).not.toBeCloseTo(472_301 / total.monthly[0], 5); // 총계 대비가 아님을 확인
    expect(rows.find((r) => r.id === 'cat-savings-ratio')).toBeUndefined(); // 저축성지출은 비율 행이 없다
  });
});

describe('buildAnnualExpenseDetailReport', () => {
  const categories = [
    category({
      id: 'cat-savings', name: '저축성지출',
      subcategories: [{ id: 'sub-deposit', categoryId: 'cat-savings', name: '예/적금', isActive: true }],
    }),
    category({
      id: 'cat-insurance', name: '보험비',
      subcategories: [
        { id: 'sub-guaranteed', categoryId: 'cat-insurance', name: '보장성', isActive: true },
        { id: 'sub-variable-dup', categoryId: 'cat-insurance', name: '변액연금', isActive: true }, // 저축성지출과 이름이 겹치는 중복 — 표시에서만 제외
      ],
    }),
  ];

  it('excludes 보험비 아래 중복 변액연금 from display only, and stamps groupLabel on each group\'s first row', () => {
    const transactions = [
      tx({ categoryId: 'cat-savings', subcategoryId: 'sub-deposit', amount: 6_050_000 }),
      tx({ categoryId: 'cat-insurance', subcategoryId: 'sub-guaranteed', amount: 409_342 }),
      tx({ categoryId: 'cat-insurance', subcategoryId: 'sub-variable-dup', amount: 256_440 }), // 실거래 — 데이터는 살아있지만 행은 숨긴다
    ];
    const rows = buildAnnualExpenseDetailReport(transactions, MONTHS, categories);

    expect(rows.find((r) => r.id === 'sub-variable-dup')).toBeUndefined();
    const savingsSubtotal = rows.find((r) => r.id === 'expense-detail-savings-subtotal')!;
    expect(savingsSubtotal.monthly[0]).toBe(6_050_000);
    const guaranteedRow = rows.find((r) => r.id === 'sub-guaranteed')!;
    expect(guaranteedRow.groupLabel).toBe('보험비'); // 그룹 첫 소분류 행에만 대분류 라벨
    const grandTotal = rows.find((r) => r.id === 'expense-detail-grand-total')!;
    expect(grandTotal.monthly[0]).toBe(6_050_000 + 409_342 + 256_440); // 숨긴 항목도 총계엔 그대로 반영(표시만 숨김)
    expect(rows[0].id).toBe('expense-detail-grand-total'); // 지출 총계가 맨 위
  });
});
