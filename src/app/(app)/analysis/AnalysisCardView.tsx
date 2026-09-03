'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import type { PaymentMethod } from '@/lib/payment-methods';
import { summarizeCardUsage, reportMonthOf, type AnalysisRow } from '@/lib/analysis';
import { AnalysisBarChart } from './AnalysisBarChart';
import { SimpleDrilldown } from './AnalysisDrilldown';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

// §10 — 원본 엑셀의 연간_카드별지출에 대응하는, 일반 지출 분석과 분리된 카드 사용 분석. 신용/
// 체크카드 결제수단만 대상이고, "실제 지출(저축성지출 포함)"과 "참고 거래"를 항상 구분해서
// 보여준다 — 카드 사용액과 가계 총지출은 다른 개념이라는 걸 문구로 계속 명시한다.
export function AnalysisCardView({ scope, months, periodTransactions, allTransactions, paymentMethods }: {
  scope: 'year' | 'month'; year: string; months: string[];
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  paymentMethods: PaymentMethod[];
}) {
  const usage = useMemo(() => summarizeCardUsage(periodTransactions, paymentMethods), [periodTransactions, paymentMethods]);
  const cardRows: AnalysisRow[] = usage.cards.map((c) => ({ id: c.id, label: c.label, value: c.totalAmount, count: c.count }));
  const cardMethods = useMemo(() => new Set(paymentMethods.filter((m) => m.methodType === 'credit_card' || m.methodType === 'check_card').map((m) => m.id)), [paymentMethods]);
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.paymentMethodId === id && (t.flowClass === 'consumption' || t.transactionType === 'reference'));
  const monthlyTotals = useMemo(() => scope === 'year' ? months.map((m) => ({ month: m, value: allTransactions.filter((t) => t.status === 'posted' && t.paymentMethodId && cardMethods.has(t.paymentMethodId) && (t.flowClass === 'consumption' || t.transactionType === 'reference') && reportMonthOf(t) === m).reduce((sum, t) => sum + t.amount, 0) })) : [], [scope, allTransactions, months, cardMethods]);
  const creditShare = usage.total > 0 ? usage.creditTotal / usage.total : 0;

  return <div className="analysis-view flex flex-col gap-4">
    <section className="tds-card p-5">
      <h2 className="text-lg font-bold">전체 카드 사용액</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">실제 지출 카드 사용액</p><p className="mt-2 text-xl font-bold tabular-nums">{money(usage.totalExpense)}</p></div>
        <div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">참고 거래 카드 사용액</p><p className="mt-2 text-xl font-bold tabular-nums">{money(usage.totalReference)}</p></div>
        <div className="tds-card p-4"><p className="text-xs text-[var(--tds-grey-500)]">전체 카드 사용액</p><p className="mt-2 text-xl font-bold tabular-nums">{money(usage.total)}</p></div>
      </div>
      <p className="mt-3 text-xs text-[var(--tds-grey-500)]">카드 사용액은 가계 총지출과 다른 개념이에요 — 참고 거래 카드 사용액은 총지출에 포함되지 않아요. 신용카드 {(creditShare * 100).toFixed(0)}% · 체크카드 {((1 - creditShare) * 100).toFixed(0)}%</p>
    </section>
    <AnalysisBarChart title="카드별 사용액" description="신용·체크카드 결제수단만 집계했어요(현금·계좌이체 제외)." rows={cardRows} tone="expense" />
    {scope === 'year' && monthlyTotals.some((m) => m.value > 0) && <section className="tds-card p-5"><h2 className="text-lg font-bold">월별 카드 사용 추이</h2><ul className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-4 md:grid-cols-6">{monthlyTotals.map((m) => <li key={m.month} className="tds-card p-3"><p className="text-xs text-[var(--tds-grey-500)]">{Number(m.month.slice(5, 7))}월</p><p className="mt-1 font-semibold tabular-nums">{money(m.value)}</p></li>)}</ul></section>}
    <section className="tds-card p-5"><h2 className="text-lg font-bold">카드별 상세</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">카드를 누르면 실제 지출·참고 거래를 포함한 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={cardRows} total={usage.total} emptyText="카드로 결제된 거래가 없어요" transactionsFor={transactionsFor} /></div></section>
  </div>;
}
