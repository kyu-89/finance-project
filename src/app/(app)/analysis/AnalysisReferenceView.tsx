'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import { summarizeReferenceByPaymentMethod, reportMonthOf } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

// §9 — 참고 거래 > 결제수단(또는 참고 거래 분류) > 개별 거래. 수입·지출·순현금흐름에서 이미
// 제외된 금액이라는 걸 문구로 계속 명시한다 — "참고 거래 금액"/"카드 사용액"으로만 부르고
// "총지출"이라는 말은 쓰지 않는다.
export function AnalysisReferenceView({ scope, months, periodTransactions, allTransactions, paymentMethodNames, subcategoryNames }: {
  scope: 'year' | 'month'; year: string; months: string[];
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  paymentMethodNames: Map<string, string>; subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeReferenceByPaymentMethod(periodTransactions, paymentMethodNames), [periodTransactions, paymentMethodNames]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const count = periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'reference').length;
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'reference' && (t.paymentMethodId ?? 'unassigned') === id);
  // 참고 거래는 대분류·소분류가 없어도 정상(§4)이라 '-'로 비워 보여준다.
  const extraColumn: TransactionExtraColumn = { label: '분류', valueFor: (t) => (t.subcategoryId ? subcategoryNames.get(t.subcategoryId) ?? '기타' : '-') };
  // 참고 거래는 flow_class가 'excluded'라 monthlyCashflow(수입/지출 전용)로는 못 잡아서 직접 합산한다.
  const monthly = useMemo(() => scope === 'year' ? months.map((m) => ({ month: m, value: allTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'reference' && reportMonthOf(t) === m).reduce((sum, t) => sum + t.amount, 0) })) : [], [scope, allTransactions, months]);

  return <div className="analysis-view flex flex-col gap-4">
    <section className="tds-card p-5"><p className="text-sm text-[var(--tds-grey-700)]">참고 거래는 수입·지출·순현금흐름에 포함되지 않아요. 결제수단이 카드면 &quot;카드 사용&quot; 탭의 카드 사용액에도 함께 잡혀요.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2"><div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">참고 거래 건수</p><p className="mt-2 text-xl font-bold tabular-nums">{count}건</p></div><div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">참고 거래 총액</p><p className="mt-2 text-xl font-bold tabular-nums">{money(total)}</p></div></div>
    </section>
    {scope === 'year' && monthly.some((m) => m.value > 0) && <section className="tds-card p-5"><h2 className="text-lg font-bold">월별 참고 거래 추이</h2><ul className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-4 md:grid-cols-6">{monthly.map((m) => <li key={m.month} className="tds-card p-3"><p className="text-xs text-[var(--tds-grey-500)]">{Number(m.month.slice(5, 7))}월</p><p className="mt-1 font-semibold tabular-nums">{money(m.value)}</p></li>)}</ul></section>}
    <section className="tds-card p-5"><h2 className="text-lg font-bold">결제수단별 참고 거래</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">항목을 누르면 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={rows} total={total} emptyText="참고 거래가 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
  </div>;
}
