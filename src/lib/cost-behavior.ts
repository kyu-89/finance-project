export type CostBehavior = 'fixed' | 'variable' | null;
// 2026-09: 거래 유형은 수입/지출 두 가지뿐이다. 환불/취소는 transaction_type이 아니라
// transactions.status('cancelled'/'refunded')로 표현한다(TransactionStatusEditor 참고) — 별도
// status='posted' 필터에 자동으로 걸러지므로 새 type이 필요 없다. 저축/투자/대출원금/금융비용/이체는
// 전부 expense + 카테고리(저축성지출/주거비 등)로 표현한다(카테고리가 이미 "무슨 종류의 지출인지"를
// 구분해준다는 원칙 — docs 세션 합의).
export type TransactionType = 'income' | 'expense';

// PRD §4.1 "비용 성격(cost behavior)": expense만 fixed/variable을 가진다.
export function resolveCostBehavior(
  transactionType: TransactionType,
  categoryDefaultCostBehavior: CostBehavior,
  override: CostBehavior,
): CostBehavior {
  if (transactionType !== 'expense') {
    return null;
  }
  return override ?? categoryDefaultCostBehavior;
}
