import type { TransactionSummary } from '@/lib/transactions';
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
export type CardUsageRow = { id: string; label: string; methodType: string; expenseAmount: number; referenceAmount: number; totalAmount: number; count: number };
export type MonthPoint = { month: string; income: number; expense: number; savings: number; net: number };
export type DayPoint = { date: string; income: number; expense: number; savings: number };

export type AnalysisTransaction = TransactionSummary;
export const reportMonthOf = (t: AnalysisTransaction) => t.sourceMonth ?? t.transactionDate.slice(0, 7);

// annual-report.ts(§12 연간 리포트)도 이 네 필터를 그대로 재사용한다 — "수입/지출/참고거래를
// 어떻게 판별하는가"라는 규칙은 이 파일 하나에만 있어야 하고, 두 번째 정의가 생기면 반드시 어긋난다.
export const posted = (t: AnalysisTransaction) => t.status === 'posted';
export const isIncome = (t: AnalysisTransaction) => posted(t) && t.transactionType === 'income';
export const isExpense = (t: AnalysisTransaction) => posted(t) && t.flowClass === 'consumption';
export const isReference = (t: AnalysisTransaction) => posted(t) && t.transactionType === 'reference';

export function periodTotals(transactions: AnalysisTransaction[], savingsCategoryId: string | null) {
  let income = 0;
  let expense = 0;
  let savings = 0;
  let referenceCount = 0;
  let referenceTotal = 0;
  for (const transaction of transactions) {
    if (isIncome(transaction)) income += transaction.amount;
    if (isExpense(transaction)) {
      expense += transaction.amount;
      if (savingsCategoryId && transaction.categoryId === savingsCategoryId) savings += transaction.amount;
    }
    if (isReference(transaction)) {
      referenceCount += 1;
      referenceTotal += transaction.amount;
    }
  }
  return {
    income, expense, savings, net: income - expense,
    referenceCount,
    referenceTotal,
  };
}

// §7 — 수입은 대분류가 하나뿐이라 바로 소분류를 보여준다.
export function summarizeIncomeBySubcategory(transactions: AnalysisTransaction[], subcategoryNames: Map<string, string>): AnalysisRow[] {
  const rows = new Map<string, AnalysisRow>();
  for (const t of transactions.filter(isIncome)) {
    const id = t.subcategoryId ?? 'unassigned';
    const row = rows.get(id) ?? { id, label: subcategoryNames.get(id) ?? '기타 수입', value: 0, count: 0 };
    row.value += t.amount; row.count += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
}

// §8 — 지출 > 대분류 > 개별 거래. 저축성지출도 다른 대분류와 똑같이 이 목록의 항목 하나일 뿐이다.
// 2026-09(사용자 지시: "d는... 저축성 지출 클릭하면 소분류 컬럼 달아서 쭉 보여줘. 다른 것과
// 동일하게 1단계 구조로 통일") — 예전엔 대분류→소분류→개별거래 3단계였는데(소분류마다 또
// 합계·클릭이 있었음), 이제 나머지 세 분석(수입/참고거래/카드사용)과 똑같이 대분류→개별거래
// 1단계다. 소분류 정보는 사라지지 않고 개별 거래 표의 "소분류" 컬럼으로 옮겨갔다
// (AnalysisExpenseView의 extraColumn 참고) — 그래서 subcategoryNames는 이제 이 함수가 아니라
// 그 컬럼을 만드는 호출부에서 쓴다.
export function summarizeExpenseByCategory(transactions: AnalysisTransaction[], categoryNames: Map<string, string>): AnalysisRow[] {
  const rows = new Map<string, AnalysisRow>();
  for (const t of transactions.filter(isExpense)) {
    const id = t.categoryId ?? 'unassigned';
    const row = rows.get(id) ?? { id, label: categoryNames.get(id) ?? '미분류', value: 0, count: 0 };
    row.value += t.amount; row.count += 1;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
}

// §9 — 참고 거래 > 결제수단.
export function summarizeReferenceByPaymentMethod(transactions: AnalysisTransaction[], paymentMethodNames: Map<string, string>): AnalysisRow[] {
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
export function summarizeCardUsage(transactions: AnalysisTransaction[], paymentMethods: PaymentMethod[]) {
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

// 연간 — 12개월 현금흐름(수입/지출/저축성지출/순현금흐름).
export function monthlyCashflow(transactions: AnalysisTransaction[], months: string[], savingsCategoryId: string | null): MonthPoint[] {
  const totalsByMonth = new Map<string, { income: number; expense: number; savings: number }>();
  for (const month of months) totalsByMonth.set(month, { income: 0, expense: 0, savings: 0 });
  for (const transaction of transactions) {
    const totals = totalsByMonth.get(reportMonthOf(transaction));
    if (!totals || !posted(transaction)) continue;
    if (isIncome(transaction)) totals.income += transaction.amount;
    if (isExpense(transaction)) {
      totals.expense += transaction.amount;
      if (savingsCategoryId && transaction.categoryId === savingsCategoryId) totals.savings += transaction.amount;
    }
  }
  return months.map((month) => { const totals = totalsByMonth.get(month)!; return { month, ...totals, net: totals.income - totals.expense }; });
}

// §3 — 대시보드 "핵심 인사이트". 실제 데이터로 뒷받침되는 문장만 만든다(사용자 지시: "근거 없는
// 문장을 생성하지 않는다") — 비교 대상 달에 데이터가 아예 없으면 그 인사이트는 만들지 않는다.
export function generateInsights(input: {
  currentMonth: AnalysisTransaction[]; previousMonth: AnalysisTransaction[]; trailing3Months: AnalysisTransaction[];
  categoryNames: Map<string, string>; incomeSubcategoryNames: Map<string, string>;
}): string[] {
  const insights: string[] = [];
  const byCategory = (rows: AnalysisTransaction[]) => { const map = new Map<string, number>(); for (const t of rows) if (t.status === 'posted' && t.flowClass === 'consumption' && t.categoryId) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount); return map; };
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
export function dailyCashflow(transactions: AnalysisTransaction[], monthStart: string, monthEnd: string, savingsCategoryId: string | null): DayPoint[] {
  const days: DayPoint[] = [];
  const totalsByDate = new Map<string, { income: number; expense: number; savings: number }>();
  for (const transaction of transactions) {
    if (!posted(transaction)) continue;
    const totals = totalsByDate.get(transaction.transactionDate) ?? { income: 0, expense: 0, savings: 0 };
    if (isIncome(transaction)) totals.income += transaction.amount;
    if (isExpense(transaction)) {
      totals.expense += transaction.amount;
      if (savingsCategoryId && transaction.categoryId === savingsCategoryId) totals.savings += transaction.amount;
    }
    totalsByDate.set(transaction.transactionDate, totals);
  }
  const start = new Date(`${monthStart}T00:00:00Z`); const end = new Date(`${monthEnd}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const totals = totalsByDate.get(date) ?? { income: 0, expense: 0, savings: 0 };
    days.push({ date, income: totals.income, expense: totals.expense, savings: totals.savings });
  }
  return days;
}
