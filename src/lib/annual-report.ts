import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import { isExpense, isIncome, isReference, reportMonthOf } from '@/lib/analysis';

// "분석 > 연간 리포트" — 원본 엑셀의 [연간_항목별수입]/[연간_카드별지출]/[연간_항목별지출]/
// [연간_세부항목별지출] 4개 시트를 행 단위로 그대로 재현한다(사용자 지시: "엑셀 그대로의 구조로
// 보고싶어... 모든 열과 행의 데이터, 구조, 위계 등").
//
// analysis.ts의 다른 집계 함수들(summarizeExpenseMatrix 등)은 "카테고리/소분류/결제수단을 값
// 기준으로 재집계해서 보여주는 새 표"였다 — 이게 바로 사용자가 지적한 문제("니맘대로 빼고 위계도
// 깨뜨린거야")의 원인이었다. 여기서는 그 대신 시트 하나당 "행 순서·행 종류가 고정된 템플릿"을
// 코드로 명시하고, 각 행의 숫자만 그때그때 살아있는 거래로 재계산한다:
//   - item: 실제 카테고리/소분류/결제수단에 연결된 항목 행 (클릭하면 개별 거래를 펼칠 수 있다)
//   - subtotal/total: item 행 중 정해진 부분집합을 더한 계산 행 (엑셀의 "○○계"/"총계"/"○○ 합계")
//   - ratio: 다른 두 행의 비율(%) 행
//   - checksum: ratio 행들의 합 — 엑셀의 "계"(≈1) 행을 그대로 재현한다
// item 행이 아닌 나머지는 클릭 드릴다운이 없다(합쳐진 값이라 "그 항목의 거래"라는 게 없다).
export type AnnualReportRowKind = 'item' | 'subtotal' | 'total' | 'ratio' | 'checksum';
export type AnnualReportRow = {
  kind: AnnualReportRowKind;
  // item 행: 실제 categoryId/subcategoryId/paymentMethodId(드릴다운에 쓰인다).
  // 계산 행: 다른 행과 겹치지 않는 합성 id일 뿐, 드릴다운에는 쓰이지 않는다.
  id: string;
  label: string;
  // 연간_세부항목별지출의 대분류 그룹 중 "그 대분류의 첫 소분류 행"에서만 채운다 — 엑셀의
  // 병합 셀(대분류 칸이 그룹 첫 행에만 보이고 나머지는 비어 있는 모양)을 그대로 흉내낸다.
  groupLabel?: string;
  // item/subtotal/total: 원(₩) 금액. ratio/checksum: 0~1 사이 비율.
  monthly: number[];
  // item/subtotal/total: monthly의 합(연간 합계). ratio/checksum: monthly의 평균(연평균 비율).
  total: number;
};

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function sumArray(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function average(values: number[]): number {
  return values.length ? sumArray(values) / values.length : 0;
}

function sumSeries(series: number[][], monthCount: number): number[] {
  const out = zeros(monthCount);
  for (const values of series) {
    for (let i = 0; i < monthCount; i += 1) out[i] += values[i] ?? 0;
  }
  return out;
}

function divideSeries(numerator: number[], denominator: number[]): number[] {
  return numerator.map((value, index) => (denominator[index] > 0 ? value / denominator[index] : 0));
}

function subtractSeries(a: number[], b: number[]): number[] {
  return a.map((value, index) => value - (b[index] ?? 0));
}

// "이 필터를 만족하는 거래 전부"의 월별 합계 — 개별 항목(카테고리/소분류/결제수단)으로 쪼개지
// 않는다. 총계/소비성지출 계 같은 합계 행을 "표시되는 개별 항목 행들의 합"이 아니라 "실제 거래
// 전체의 합"으로 계산하는 데 쓴다 — 그래야 표에 나열되지 않는 카테고리(예: 시스템 폴백
// "미분류")나 표시에서만 뺀 소분류(예: 보험비의 중복 변액연금)에 걸린 실거래 금액이 총계에서
// 조용히 사라지지 않는다.
function sumAllMonthly(transactions: Transaction[], months: string[]): number[] {
  const out = zeros(months.length);
  for (const t of transactions) {
    const monthIndex = months.indexOf(reportMonthOf(t));
    if (monthIndex === -1) continue;
    out[monthIndex] += t.amount;
  }
  return out;
}

// keyFor가 돌려주는 키(카테고리/소분류/결제수단 id)별로 월별 합계 배열을 만든다. buildMatrix
// (analysis.ts §12)와 같은 집계 방식이지만, 여기서는 "이미 정해진 행 목록"에 값만 채워 넣는
// 용도라 정렬하지 않고 Map만 돌려준다.
function sumByKey(transactions: Transaction[], months: string[], keyFor: (t: Transaction) => string | null): Map<string, number[]> {
  const byKey = new Map<string, number[]>();
  for (const t of transactions) {
    const key = keyFor(t);
    if (key === null) continue;
    const monthIndex = months.indexOf(reportMonthOf(t));
    if (monthIndex === -1) continue;
    const monthly = byKey.get(key) ?? zeros(months.length);
    monthly[monthIndex] += t.amount;
    byKey.set(key, monthly);
  }
  return byKey;
}

// §1 — 연간_항목별수입. "이월"은 원본 엑셀에 없는 행이라 제외한다(대분류 "수입"의 소분류 중
// 유일하게 실제 시트에 없는 항목). "주소득"/"부소득"은 income_group(고정수입/부가 수입)과는
// 다른 축이다 — 급여·수당·상여만 주소득, 나머지(투자수익·이자·부수익·처분소득·기타 수입)는
// 부소득으로, 4개 연도(2023~2026) 엑셀의 주소득계/부소득계 값을 역산해 확인한 매핑이다
// (사용자 지시: "이건 엑셀대로 매핑해").
const PRIMARY_INCOME_SUBCATEGORY_NAMES = new Set(['급여', '수당', '상여']);

export function buildAnnualIncomeReport(transactions: Transaction[], months: string[], incomeCategory: CategoryWithSubcategories | undefined): AnnualReportRow[] {
  const n = months.length;
  if (!incomeCategory) return [];
  const carryoverId = incomeCategory.subcategories.find((s) => s.name === '이월')?.id;
  const subcategories = incomeCategory.subcategories.filter((s) => s.name !== '이월');
  const primarySubcategoryIds = new Set(subcategories.filter((s) => PRIMARY_INCOME_SUBCATEGORY_NAMES.has(s.name)).map((s) => s.id));
  // "이월"은 그 해 새로 들어온 수입이 아니라 이전 기간 잔액의 이월이라 원본 엑셀도 총계에
  // 넣지 않는다 — 그래서 이 하나만은 의도적으로 제외하고, 그 밖의(향후 추가될 수 있는) 소분류는
  // 목록에 없어도 총계/부소득계에서 새지 않도록 sumAllMonthly로 anchor를 잡는다.
  const countedIncome = transactions.filter((t) => isIncome(t) && t.subcategoryId !== carryoverId);
  const sums = sumByKey(countedIncome, months, (t) => t.subcategoryId ?? 'unassigned');

  const itemRows: AnnualReportRow[] = subcategories.map((s) => {
    const monthly = sums.get(s.id) ?? zeros(n);
    return { kind: 'item', id: s.id, label: s.name, monthly, total: sumArray(monthly) };
  });
  const totalMonthly = sumAllMonthly(countedIncome, months);
  const primaryMonthly = sumAllMonthly(countedIncome.filter((t) => primarySubcategoryIds.has(t.subcategoryId ?? '')), months);
  const secondaryMonthly = subtractSeries(totalMonthly, primaryMonthly);
  const primaryRatio = divideSeries(primaryMonthly, totalMonthly);
  const secondaryRatio = divideSeries(secondaryMonthly, totalMonthly);
  const checksum = sumSeries([primaryRatio, secondaryRatio], n);

  return [
    ...itemRows,
    { kind: 'subtotal', id: 'income-primary-subtotal', label: '주소득계', monthly: primaryMonthly, total: sumArray(primaryMonthly) },
    { kind: 'subtotal', id: 'income-secondary-subtotal', label: '부소득계', monthly: secondaryMonthly, total: sumArray(secondaryMonthly) },
    { kind: 'total', id: 'income-total', label: '총계', monthly: totalMonthly, total: sumArray(totalMonthly) },
    { kind: 'ratio', id: 'income-primary-ratio', label: '주소득율', monthly: primaryRatio, total: average(primaryRatio) },
    { kind: 'ratio', id: 'income-secondary-ratio', label: '부소득율', monthly: secondaryRatio, total: average(secondaryRatio) },
    { kind: 'checksum', id: 'income-checksum', label: '계', monthly: checksum, total: average(checksum) },
  ];
}

// §2 — 연간_카드별지출. 원본 엑셀은 "카드"뿐 아니라 계좌이체·현금·상품권까지 모든 결제수단을
// 나열한다 — summarizeCardUsage(§10, "카드 사용액" KPI)가 credit_card/check_card만 남기던
// 필터를 여기서는 쓰지 않는다(사용자 지시: "카드별 지출에서는 계좌이체나 성북사랑상품권 등 항목
// 누락"). "체크카드/상품권 합계"는 원본 엑셀 수식이 상품권류 일부를 빠뜨리고 있었는데(예:
// 성북사랑상품권 누락), 그대로 재현하지 않고 논리적으로 고친다(사용자 지시: "논리적으로
// 수정해") — check_card와 other(상품권 등) 타입을 전부 포함한다. "소비 계"는 계좌이체를
// 제외한 현금+신용카드+체크카드/상품권의 합이다(4개 연도 모두 이 공식으로 검산 완료).
const CARD_REPORT_TYPE_ORDER: PaymentMethod['methodType'][] = ['account_transfer', 'cash', 'credit_card', 'check_card', 'other'];

export function buildAnnualCardReport(transactions: Transaction[], months: string[], paymentMethods: PaymentMethod[]): AnnualReportRow[] {
  const n = months.length;
  const relevant = transactions.filter((t) => t.paymentMethodId && (isExpense(t) || isReference(t)));
  const sums = sumByKey(relevant, months, (t) => t.paymentMethodId);
  const orderedMethods = CARD_REPORT_TYPE_ORDER.flatMap((type) => paymentMethods.filter((m) => m.methodType === type));

  const itemRows: AnnualReportRow[] = orderedMethods.map((m) => {
    const monthly = sums.get(m.id) ?? zeros(n);
    return { kind: 'item', id: m.id, label: m.name, monthly, total: sumArray(monthly) };
  });
  const sumFor = (type: PaymentMethod['methodType'] | PaymentMethod['methodType'][]) => {
    const types = Array.isArray(type) ? type : [type];
    const methods = orderedMethods.filter((m) => types.includes(m.methodType));
    return sumSeries(methods.map((m) => sums.get(m.id) ?? zeros(n)), n);
  };
  const transferTotal = sumFor('account_transfer');
  const cashTotal = sumFor('cash');
  const creditTotal = sumFor('credit_card');
  const checkOrVoucherTotal = sumFor(['check_card', 'other']);
  const grandTotal = sumSeries([transferTotal, cashTotal, creditTotal, checkOrVoucherTotal], n);
  const consumptionTotal = sumSeries([cashTotal, creditTotal, checkOrVoucherTotal], n);
  const cashRatio = divideSeries(cashTotal, consumptionTotal);
  const creditRatio = divideSeries(creditTotal, consumptionTotal);
  const checkRatio = divideSeries(checkOrVoucherTotal, consumptionTotal);
  const checksum = sumSeries([cashRatio, creditRatio, checkRatio], n);

  return [
    ...itemRows,
    { kind: 'total', id: 'card-grand-total', label: '지출 총계', monthly: grandTotal, total: sumArray(grandTotal) },
    { kind: 'subtotal', id: 'card-cash-subtotal', label: '현금 합계', monthly: cashTotal, total: sumArray(cashTotal) },
    { kind: 'subtotal', id: 'card-credit-subtotal', label: '신용카드 합계', monthly: creditTotal, total: sumArray(creditTotal) },
    { kind: 'subtotal', id: 'card-check-voucher-subtotal', label: '체크카드/상품권 합계', monthly: checkOrVoucherTotal, total: sumArray(checkOrVoucherTotal) },
    { kind: 'subtotal', id: 'card-consumption-subtotal', label: '소비 계', monthly: consumptionTotal, total: sumArray(consumptionTotal) },
    { kind: 'ratio', id: 'card-cash-ratio', label: '현금 비율', monthly: cashRatio, total: average(cashRatio) },
    { kind: 'ratio', id: 'card-credit-ratio', label: '신용카드 비율', monthly: creditRatio, total: average(creditRatio) },
    { kind: 'ratio', id: 'card-check-ratio', label: '체크카드 비율', monthly: checkRatio, total: average(checkRatio) },
    { kind: 'checksum', id: 'card-checksum', label: '계', monthly: checksum, total: average(checksum) },
  ];
}

// 두 지출 리포트(§3/§4) 공통 — "미분류"는 시스템 폴백 카테고리라 원본 엑셀에 없는 행이므로
// 제외한다. 저축성지출은 항상 맨 앞에 별도로 다룬다(대분류이자 엑셀의 실제 행).
function orderedExpenseCategories(categories: CategoryWithSubcategories[]): { savings: CategoryWithSubcategories | undefined; others: CategoryWithSubcategories[] } {
  const expenseCategories = categories.filter((c) => c.transactionType === 'expense' && c.name !== '미분류');
  return {
    savings: expenseCategories.find((c) => c.name === '저축성지출'),
    others: expenseCategories.filter((c) => c.name !== '저축성지출'),
  };
}

// §3 — 연간_항목별지출. "소비성지출"은 엑셀에만 있는 계산 행이다(저축성지출을 뺀 나머지 지출
// 전체의 합 — 실제 카테고리가 아니다, PRD §8/§35). 비율은 각 소비 카테고리 ÷ 소비성지출이다
// (총계 대비가 아니다 — 4개 연도 모두 이 공식으로 검산 완료). 저축성지출은 비율 행이 없다.
export function buildAnnualExpenseCategoryReport(transactions: Transaction[], months: string[], categories: CategoryWithSubcategories[]): AnnualReportRow[] {
  const n = months.length;
  const { savings, others } = orderedExpenseCategories(categories);
  const expenseTransactions = transactions.filter(isExpense);
  const sums = sumByKey(expenseTransactions, months, (t) => t.categoryId ?? 'unassigned');

  const savingsMonthly = savings ? sumAllMonthly(expenseTransactions.filter((t) => t.categoryId === savings.id), months) : zeros(n);
  const savingsRow: AnnualReportRow = { kind: 'item', id: savings?.id ?? 'savings-unassigned', label: '저축성지출', monthly: savingsMonthly, total: sumArray(savingsMonthly) };
  const otherRows: AnnualReportRow[] = others.map((c) => {
    const monthly = sums.get(c.id) ?? zeros(n);
    return { kind: 'item', id: c.id, label: c.name, monthly, total: sumArray(monthly) };
  });
  // 소비성지출 = 총지출 − 저축성지출 (otherRows의 합이 아니다) — "미분류" 같이 표에 자체 행이
  // 없는 카테고리로 걸린 실거래도 이 합계엔 그대로 반영된다(그 항목만 표에서 안 보일 뿐).
  const totalMonthly = sumAllMonthly(expenseTransactions, months);
  const consumptionMonthly = subtractSeries(totalMonthly, savingsMonthly);
  const ratioRows: AnnualReportRow[] = otherRows.map((r) => {
    const ratio = divideSeries(r.monthly, consumptionMonthly);
    return { kind: 'ratio', id: `${r.id}-ratio`, label: `${r.label}율`, monthly: ratio, total: average(ratio) };
  });
  const checksum = sumSeries(ratioRows.map((r) => r.monthly), n);

  return [
    savingsRow,
    { kind: 'subtotal', id: 'expense-consumption-subtotal', label: '소비성지출', monthly: consumptionMonthly, total: sumArray(consumptionMonthly) },
    ...otherRows,
    { kind: 'total', id: 'expense-total', label: '총계', monthly: totalMonthly, total: sumArray(totalMonthly) },
    ...ratioRows,
    { kind: 'checksum', id: 'expense-checksum', label: '계', monthly: checksum, total: average(checksum) },
  ];
}

// §4 — 연간_세부항목별지출. 연간_항목별지출(§3, 대분류 단위)과는 데이터 항목·구조가 다른 별도
// 시트다(사용자 지시: "연간_항목별지출과 연간_세부항목별지출은 데이터항목이나 구조가 달라서
// 분리해야할 것 같다") — 대분류가 아니라 전체 지출 소분류 단위이고, 대분류별로 소분류를 묶어
// 보여준다(엑셀의 병합 셀 — groupLabel은 그 그룹의 첫 소분류 행에만 채운다). 비율/체크섬 행은
// 없다(원본 엑셀에도 없다).
//
// 보험비 아래 "변액연금"은 저축성지출에 이미 있는 이름과 중복되는 실수로 생긴 소분류다(사용자
// 지시: "변액은 표시에서만 제외해봐") — 데이터는 그대로 두고(실거래 32건, 5,006,080원) 이 표에서
// 소분류 행으로만 뺀다. 그만큼 보험비 그룹의 소분류 합계가 보험비 대분류 총계보다 작게 보일 수
// 있다는 걸 알아두자(의도된 표시상의 예외다).
const DETAIL_REPORT_EXCLUDED_SUBCATEGORIES = new Set(['보험비:변액연금']);

export function buildAnnualExpenseDetailReport(transactions: Transaction[], months: string[], categories: CategoryWithSubcategories[]): AnnualReportRow[] {
  const n = months.length;
  const { savings, others } = orderedExpenseCategories(categories);
  const expenseTransactions = transactions.filter(isExpense);
  const sums = sumByKey(expenseTransactions, months, (t) => t.subcategoryId ?? 'unassigned');

  const buildSubcategoryRows = (category: CategoryWithSubcategories): AnnualReportRow[] => category.subcategories
    .filter((s) => !DETAIL_REPORT_EXCLUDED_SUBCATEGORIES.has(`${category.name}:${s.name}`))
    .map((s, index): AnnualReportRow => {
      const monthly = sums.get(s.id) ?? zeros(n);
      return { kind: 'item', id: s.id, label: s.name, groupLabel: index === 0 ? category.name : undefined, monthly, total: sumArray(monthly) };
    });

  // 저축성지출 계/소비성지출 계도 (표에 나열된) 소분류 행들의 합이 아니라 실제 카테고리 단위
  // 거래 합계로 anchor를 잡는다 — 표시에서만 뺀 소분류(보험비의 중복 변액연금 등)에 걸린 실거래
  // 금액이 총계에서 사라지지 않게 하기 위해서다.
  const savingsRows = savings ? buildSubcategoryRows(savings) : [];
  const savingsSubtotalMonthly = savings ? sumAllMonthly(expenseTransactions.filter((t) => t.categoryId === savings.id), months) : zeros(n);
  const otherRowGroups = others.map((category) => buildSubcategoryRows(category));
  const grandTotalMonthly = sumAllMonthly(expenseTransactions, months);
  const consumptionSubtotalMonthly = subtractSeries(grandTotalMonthly, savingsSubtotalMonthly);

  return [
    { kind: 'total', id: 'expense-detail-grand-total', label: '지출 총계', monthly: grandTotalMonthly, total: sumArray(grandTotalMonthly) },
    { kind: 'subtotal', id: 'expense-detail-savings-subtotal', label: '저축성지출 계', monthly: savingsSubtotalMonthly, total: sumArray(savingsSubtotalMonthly) },
    ...savingsRows,
    { kind: 'subtotal', id: 'expense-detail-consumption-subtotal', label: '소비성지출 계', monthly: consumptionSubtotalMonthly, total: sumArray(consumptionSubtotalMonthly) },
    ...otherRowGroups.flat(),
  ];
}
