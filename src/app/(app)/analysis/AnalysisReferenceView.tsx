'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import { summarizeReferenceByPaymentMethod } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

// §9 — 참고 거래 > 결제수단(또는 참고 거래 분류) > 개별 거래. 수입·지출·순현금흐름에서 이미
// 제외된 금액이라는 걸 문구로 계속 명시한다 — "참고 거래 금액"/"카드 사용액"으로만 부르고
// "총지출"이라는 말은 쓰지 않는다.
// 2026-09(사용자 지시: "분석쪽 화면 다시 재정리... 수입 > 지출 > 카드사용 > 참고 거래 순으로
// 아코디언 적용해") — 연간 스코프의 월별 추이는 AnnualReportView의 [연간_카드별지출] 등으로
// 대체됐고, 이 뷰는 이제 월간 스코프 전용(아코디언 마지막 칸)이라 연간 월별 추이 섹션을 갖지
// 않는다.
export function AnalysisReferenceView({ periodTransactions, paymentMethodNames, subcategoryNames }: {
  periodTransactions: Transaction[];
  paymentMethodNames: Map<string, string>; subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeReferenceByPaymentMethod(periodTransactions, paymentMethodNames), [periodTransactions, paymentMethodNames]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const count = periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'reference').length;
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'reference' && (t.paymentMethodId ?? 'unassigned') === id);
  // 참고 거래는 대분류·소분류가 없어도 정상(§4)이라 '-'로 비워 보여준다.
  // 2026-09(사용자 지시: "컬럼이나 디자인 시스템이 일관되지 않아") — 라벨을 "분류"에서
  // 수입·지출과 똑같은 "소분류"로 맞췄다(조회 방식이 완전히 같은데 단어만 달랐다).
  const extraColumn: TransactionExtraColumn = { label: '소분류', valueFor: (t) => (t.subcategoryId ? subcategoryNames.get(t.subcategoryId) ?? '기타' : '-') };

  return <div className="analysis-view flex flex-col gap-4">
    <section className="tds-card p-5"><p className="text-sm text-[var(--tds-grey-700)]">참고 거래는 수입·지출·순현금흐름에 포함되지 않아요. 결제수단이 카드면 &quot;카드 사용&quot; 영역의 카드 사용액에도 함께 잡혀요.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2"><div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">참고 거래 건수</p><p className="mt-2 text-xl font-bold tabular-nums">{count}건</p></div><div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">참고 거래 총액</p><p className="mt-2 text-xl font-bold tabular-nums">{money(total)}</p></div></div>
    </section>
    <section className="tds-card p-5"><h2 className="text-lg font-bold">결제수단별 참고 거래</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">항목을 누르면 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={rows} total={total} emptyText="참고 거래가 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
  </div>;
}
