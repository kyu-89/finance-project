import type { Transaction } from '@/lib/transactions';
import type { PaymentMethod } from '@/lib/payment-methods';

// "분석" 메뉴(대시보드/월간관리에서 분리된 전용 분석 화면, 2026-09)의 순수 집계 함수 모음.
// DB 호출 없이 이미 조회된 Transaction[]만 받아 동작한다 — dashboard/page.tsx가 기존에 쓰던
// buildIncomeMonthlyDetail/buildExpenseMonthlyDetail/buildTransactionDetails와 같은 패턴(1년치를
// 한 번에 받아 클라이언트에서 집계)을 따르되, 지출은 대분류→소분류 2단계, 참고거래는 결제수단
// 1단계, 카드 사용은 지출+참고거래를 합쳐서 집계하도록 확장했다.
//
// 핵심 불변식(사용자 지시, §5/§8/§9):
//   총지출 = flowClass==='consumption'인 모든 거래의 합 (저축성지출 포함, 별도로 빼거나 더하지 않음)
//   순현금흐름 = 총수입 − 총지출
//   참고 거래(flowClass==='excluded')는 수입·지출·순현금흐름·예산 분석 전부에서 제외
//   카드 사용액 = 카드 결제수단이 연결된 (지출 + 참고거래) — 수입은 절대 포함하지 않음

export type AnalysisRow = { id: string; label: string; value: number; count: number };
export type ExpenseCategoryRow = AnalysisRow & { subcategories: AnalysisRow[] };
export type CardUsageRow = { id: string; label: string; methodType: string; expenseAmount: number; referenceAmount: number; totalAmount: number; count: number };
export type MonthPoint = { month: string; income: number; expense: number; savings: number; net: number };
export type DayPoint = { date: string; income: number; expense: number; savings: number };

export const reportMonthOf = (t: Transaction) => t.sourceMonth ?? t.transactionDate.slice(0, 7);

// annual-report.ts(§12 연간 리포트)도 이 네 필터를 그대로 재사용한다 — "수입/지출/참고거래를
// 어떻게 판별하는가"라는 규칙은 이 파일 하나에만 있어야 하고, 두 번째 정의가 생기면 반드시 어긋난다.
export const posted = (t: Transaction) => t.status === 'posted';
export const isIncome = (t: Transaction) => posted(t) && t.transactionType === 'income';
export const isExpense = (t: Transaction) => posted(t) && t.flowClass === 'consumption';
export const isReference = (t: Transaction) => posted(t) && t.transactionType === 'reference';

export function periodTotals(transactions: Transaction[], savingsCategoryId: string | null) {
  const income = transactions.filter(isIncome).reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(isExpense).reduce((sum, t) => sum + t.amount, 0);
  const savings = savingsCategoryId
    ? transactions.filter((t) => isExpense(t) && t.categoryId === savingsCategoryId).reduce((sum, t) => sum + t.amount, 0)
    : 0;
  const referenceRows = transactions.filter(isReference);
  return {
    income, expense, savings, net: income - expense,
    referenceCount: referenceRows.length,
    referenceTotal: referenceRows.reduce((sum, t) => sum + t.amount, 0),
  };
}

// §7 — 수입은 대분류가 하나뿐이라 바로 소분류를 보여준다.
export function summarizeIncomeBySubcategory(transactions: Transaction[], subcategoryNames: Map<string, string>): AnalysisRow[] {
  const rows = new Map<string, AnalysisRow>();
  for (const t of transactions.filter(isIncome)) {
    const id = t.subcategoryId ?? 'unassigned';
    const row = rows.get(id) ?? { id, label: subcategoryNames.get(id) ?? '기타 수입', value: 0, count: 0 };
    row.value += t.amount; row.count += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
}

// §8 — 지출 > 대분류 > 소분류. 저축성지출도 다른 대분류와 똑같이 이 목록의 항목 하나일 뿐이다.
export function summarizeExpenseByCategory(transactions: Transaction[], categoryNames: Map<string, string>, subcategoryNames: Map<string, string>): ExpenseCategoryRow[] {
  const rows = new Map<string, ExpenseCategoryRow>();
  for (const t of transactions.filter(isExpense)) {
    const id = t.categoryId ?? 'unassigned';
    const row = rows.get(id) ?? { id, label: categoryNames.get(id) ?? '미분류', value: 0, count: 0, subcategories: [] };
    row.value += t.amount; row.count += 1;
    const subId = t.subcategoryId ?? 'unassigned';
    let sub = row.subcategories.find((s) => s.id === subId);
    if (!sub) { sub = { id: subId, label: subcategoryNames.get(subId) ?? '기타', value: 0, count: 0 }; row.subcategories.push(sub); }
    sub.value += t.amount; sub.count += 1;
    rows.set(id, row);
  }
  for (const row of rows.values()) row.subcategories.sort((a, b) => b.value - a.value);
  return [...rows.values()].sort((a, b) => b.value - a.value);
}

// §9 — 참고 거래 > 결제수단.
export function summarizeReferenceByPaymentMethod(transactions: Transaction[], paymentMethodNames: Map<string, string>): AnalysisRow[] {
  const rows = new Map<string, AnalysisRow>();
  for (const t of transactions.filter(isReference)) {
    const id = t.paymentMethodId ?? 'unassigned';
    const row = rows.get(id) ?? { id, label: paymentMethodNames.get(id) ?? '결제수단 미지정', value: 0, count: 0 };
    row.value += t.amount; row.count += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
}

// §10 — 카드별 지출: 실제 지출(저축성지출 포함, expense 전부)과 참고 거래를 결제수단별로 나눠
// 더한다. method_type이 credit_card/check_card인 결제수단만 "카드"로 집계하고, 결제수단이 없거나
// 현금·계좌이체 등이면 제외한다. 수입은 애초에 대상에서 뺀다.
export function summarizeCardUsage(transactions: Transaction[], paymentMethods: PaymentMethod[]) {
  const cardMethods = new Map(paymentMethods.filter((m) => m.methodType === 'credit_card' || m.methodType === 'check_card').map((m) => [m.id, m]));
  const rows = new Map<string, CardUsageRow>();
  for (const t of transactions) {
    if (!t.paymentMethodId || !cardMethods.has(t.paymentMethodId)) continue;
    const method = cardMethods.get(t.paymentMethodId)!;
    const row = rows.get(method.id) ?? { id: method.id, label: method.name, methodType: method.methodType, expenseAmount: 0, referenceAmount: 0, totalAmount: 0, count: 0 };
    if (isExpense(t)) { row.expenseAmount += t.amount; row.totalAmount += t.amount; row.count += 1; }
    else if (isReference(t)) { row.referenceAmount += t.amount; row.totalAmount += t.amount; row.count += 1; }
    else continue;
    rows.set(method.id, row);
  }
  const cards = [...rows.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  const totalExpense = cards.reduce((sum, c) => sum + c.expenseAmount, 0);
  const totalReference = cards.reduce((sum, c) => sum + c.referenceAmount, 0);
  const creditTotal = cards.filter((c) => c.methodType === 'credit_card').reduce((sum, c) => sum + c.totalAmount, 0);
  const checkTotal = cards.filter((c) => c.methodType === 'check_card').reduce((sum, c) => sum + c.totalAmount, 0);
  const total = totalExpense + totalReference;
  return { cards, totalExpense, totalReference, total, creditTotal, checkTotal };
}

// §12 — 원본 엑셀(연간_항목별수입/연간_카드별지출/연간_항목별지출)과 대조하기 좋은 "항목 ×
// 12개월" 매트릭스. 연간 스코프에서만 의미가 있다 — 수입 소분류/지출 대분류/카드별로 한 해
// 전체를 한 눈에 스캔하기 위한 것으로, 기존 드릴다운(항목별 합계·비중·개별거래)과는 다른
// "월별 추이 비교"라는 별도 목적이라 항목당 12칸 배열 형태로 반환한다.
export type MatrixRow = { id: string; label: string; monthly: number[]; total: number };

function buildMatrix(rows: Transaction[], months: string[], keyFor: (t: Transaction) => string | null, names: Map<string, string>, fallbackLabel: string): MatrixRow[] {
  const byKey = new Map<string, MatrixRow>();
  for (const t of rows) {
    const key = keyFor(t);
    if (key === null) continue;
    const monthIndex = months.indexOf(reportMonthOf(t));
    if (monthIndex === -1) continue;
    const row = byKey.get(key) ?? { id: key, label: names.get(key) ?? fallbackLabel, monthly: months.map(() => 0), total: 0 };
    row.monthly[monthIndex] += t.amount;
    row.total += t.amount;
    byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total);
}

// §7 대응 — 수입 소분류 × 월.
export function summarizeIncomeMatrix(transactions: Transaction[], months: string[], subcategoryNames: Map<string, string>): MatrixRow[] {
  return buildMatrix(transactions.filter(isIncome), months, (t) => t.subcategoryId ?? 'unassigned', subcategoryNames, '기타 수입');
}

// §8 대응 — 지출 대분류 × 월(저축성지출도 다른 대분류와 동일하게 한 행일 뿐). 원본 엑셀의
// 연간_항목별지출 시트와 대응.
export function summarizeExpenseMatrix(transactions: Transaction[], months: string[], categoryNames: Map<string, string>): MatrixRow[] {
  return buildMatrix(transactions.filter(isExpense), months, (t) => t.categoryId ?? 'unassigned', categoryNames, '미분류');
}

// 2026-09(사용자 지시: "연간_항목별지출과 연간_세부항목별지출은 데이터 항목이나 구조가 달라서
// 분리해야할 것 같다") — 연간_항목별지출은 대분류 단위(14~16행), 연간_세부항목별지출은 전체
// 지출 소분류 단위(저축성지출 9개 포함 전체 카테고리의 소분류, 훨씬 더 많은 행)로 서로 다른
// 원본 시트다. summarizeExpenseMatrix(대분류)와 별개로, 소분류 단위 매트릭스를 따로 둔다.
export function summarizeExpenseSubcategoryMatrix(transactions: Transaction[], months: string[], subcategoryNames: Map<string, string>): MatrixRow[] {
  return buildMatrix(transactions.filter(isExpense), months, (t) => t.subcategoryId ?? 'unassigned', subcategoryNames, '기타');
}

// §10 대응 — 카드(신용·체크만) × 월. summarizeCardUsage와 같은 대상(실제지출+참고거래)을 합쳐
// 집계한다 — 카드 사용액과 총지출은 다른 개념이라는 원칙을 매트릭스에서도 그대로 지킨다.
export function summarizeCardUsageMatrix(transactions: Transaction[], months: string[], paymentMethods: PaymentMethod[]): MatrixRow[] {
  const cardMethods = new Map(paymentMethods.filter((m) => m.methodType === 'credit_card' || m.methodType === 'check_card').map((m) => [m.id, m]));
  const names = new Map([...cardMethods.values()].map((m) => [m.id, m.name]));
  return buildMatrix(
    transactions.filter((t) => t.paymentMethodId && cardMethods.has(t.paymentMethodId) && (isExpense(t) || isReference(t))),
    months, (t) => t.paymentMethodId, names, '결제수단 미지정',
  );
}

// 연간 — 12개월 현금흐름(수입/지출/저축성지출/순현금흐름).
export function monthlyCashflow(transactions: Transaction[], months: string[], savingsCategoryId: string | null): MonthPoint[] {
  return months.map((month) => {
    const rows = transactions.filter((t) => reportMonthOf(t) === month);
    const totals = periodTotals(rows, savingsCategoryId);
    return { month, income: totals.income, expense: totals.expense, savings: totals.savings, net: totals.net };
  });
}

// §3 — 대시보드 "핵심 인사이트". 실제 데이터로 뒷받침되는 문장만 만든다(사용자 지시: "근거 없는
// 문장을 생성하지 않는다") — 비교 대상 달에 데이터가 아예 없으면 그 인사이트는 만들지 않는다.
export function generateInsights(input: {
  currentMonth: Transaction[]; previousMonth: Transaction[]; trailing3Months: Transaction[];
  categoryNames: Map<string, string>; incomeSubcategoryNames: Map<string, string>;
}): string[] {
  const insights: string[] = [];
  const byCategory = (rows: Transaction[]) => { const map = new Map<string, number>(); for (const t of rows) if (t.status === 'posted' && t.flowClass === 'consumption' && t.categoryId) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount); return map; };
  const current = byCategory(input.currentMonth);
  const previous = byCategory(input.previousMonth);

  // 1) 지난달보다 가장 많이 늘어난 카테고리 (전월에도 값이 있어야 비교가 성립한다).
  let biggestIncreaseId: string | null = null; let biggestIncrease = 0;
  for (const [id, value] of current) {
    const prev = previous.get(id) ?? 0;
    const diff = value - prev;
    if (prev > 0 && diff > biggestIncrease && diff >= 50_000) { biggestIncrease = diff; biggestIncreaseId = id; }
  }
  if (biggestIncreaseId) insights.push(`지난달보다 ${input.categoryNames.get(biggestIncreaseId) ?? '지출'}에 ${biggestIncrease.toLocaleString('ko-KR')}원 더 썼어요.`);

  // 2) 최근 3개월 평균보다 눈에 띄게 높은 카테고리(현재 달 제외 최근 3개월 평균 대비 +30% 이상,
  // 두 값 모두 존재할 때만).
  const trailingByCategory = byCategory(input.trailing3Months);
  let overAverageId: string | null = null;
  for (const [id, value] of current) {
    const trailingTotal = trailingByCategory.get(id) ?? 0;
    const average = trailingTotal / 3;
    if (average > 0 && value > average * 1.3 && id !== biggestIncreaseId) { overAverageId = id; break; }
  }
  if (overAverageId) insights.push(`최근 3개월 평균보다 ${input.categoryNames.get(overAverageId) ?? '지출'}이 높아요.`);

  // 3) 이번 달 최대 수입원이 전체 수입의 과반을 차지하는 경우.
  const incomeRows = summarizeIncomeBySubcategory(input.currentMonth, input.incomeSubcategoryNames);
  const totalIncome = incomeRows.reduce((sum, r) => sum + r.value, 0);
  const topIncome = incomeRows[0];
  if (topIncome && totalIncome > 0 && topIncome.value / totalIncome >= 0.5) {
    insights.push(`이번 달 ${topIncome.label}이 전체 수입의 ${(topIncome.value / totalIncome * 100).toFixed(0)}%를 차지해요.`);
  }

  return insights.slice(0, 3);
}

// 월간 — 선택한 달의 일별 현금흐름.
export function dailyCashflow(transactions: Transaction[], monthStart: string, monthEnd: string, savingsCategoryId: string | null): DayPoint[] {
  const days: DayPoint[] = [];
  const start = new Date(`${monthStart}T00:00:00Z`); const end = new Date(`${monthEnd}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const rows = transactions.filter((t) => t.transactionDate === date);
    const totals = periodTotals(rows, savingsCategoryId);
    days.push({ date, income: totals.income, expense: totals.expense, savings: totals.savings });
  }
  return days;
}
