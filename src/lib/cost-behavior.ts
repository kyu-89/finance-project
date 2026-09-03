export type CostBehavior = 'fixed' | 'variable' | null;
// 2026-09: 거래 유형은 수입/지출/참고 거래 세 가지다. 환불/취소는 transaction_type이 아니라
// transactions.status('cancelled'/'refunded')로 표현한다(TransactionStatusEditor 참고) — 별도
// status='posted' 필터에 자동으로 걸러지므로 새 type이 필요 없다. 저축/투자/대출원금/금융비용/이체는
// 전부 expense + 카테고리(저축성지출/주거비 등)로 표현한다(카테고리가 이미 "무슨 종류의 지출인지"를
// 구분해준다는 원칙 — docs 세션 합의). '참고 거래'(reference)는 카드 대납·현금 환급처럼 가계
// 수입·지출로 볼 수 없지만 기록·결제수단 분석용으로 보존해야 하는 거래를 위한 세 번째 유형이다
// (사용자 지시) — flow_class가 별도의 'excluded' 값이라 총수입/총지출 등 모든 집계에서 자동 제외된다.
export type TransactionType = 'income' | 'expense' | 'reference';

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
