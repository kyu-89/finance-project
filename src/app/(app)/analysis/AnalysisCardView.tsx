'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import type { PaymentMethod } from '@/lib/payment-methods';
import { summarizeCardUsage, summarizeCardUsageMatrix, reportMonthOf, type AnalysisRow } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';
import { AnalysisHeatmapTable } from './AnalysisHeatmapTable';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;

// §10 — 원본 엑셀의 연간_카드별지출에 대응하는, 일반 지출 분석과 분리된 카드 사용 분석. 신용/
// 체크카드 결제수단만 대상이고, "실제 지출(저축성지출 포함)"과 "참고 거래"를 항상 구분해서
// 보여준다 — 카드 사용액과 가계 총지출은 다른 개념이라는 걸 문구로 계속 명시한다.
export function AnalysisCardView({ scope, months, monthCount, periodTransactions, paymentMethods }: {
  scope: 'year' | 'month'; year: string; months: string[]; monthCount: number;
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  paymentMethods: PaymentMethod[];
}) {
  const usage = useMemo(() => summarizeCardUsage(periodTransactions, paymentMethods), [periodTransactions, paymentMethods]);
  const cardRows: AnalysisRow[] = usage.cards.map((c) => ({ id: c.id, label: c.label, value: c.totalAmount, count: c.count }));
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.paymentMethodId === id && (t.flowClass === 'consumption' || t.transactionType === 'reference'));
  const creditShare = usage.total > 0 ? usage.creditTotal / usage.total : 0;
  const extraColumn: TransactionExtraColumn = { label: '구분', valueFor: (t) => (t.transactionType === 'reference' ? '참고 거래' : '실제 지출') };
  // §12 — 원본 엑셀 연간_카드별지출과 대응하는 카드 × 12개월 표. 기존 "월별 카드 사용 추이"(전체
  // 카드 합계만 보여주던 것)를 대체한다 — 이 표가 카드별로 더 자세히 같은 정보를 보여준다.
  const matrixRows = useMemo(() => scope === 'year' ? summarizeCardUsageMatrix(periodTransactions, months, paymentMethods) : [], [scope, periodTransactions, months, paymentMethods]);
  const matrixTransactionsFor = (id: string, month: string) => periodTransactions.filter((t) => t.status === 'posted' && t.paymentMethodId === id && (t.flowClass === 'consumption' || t.transactionType === 'reference') && reportMonthOf(t) === month);

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
    {scope === 'year' && <AnalysisHeatmapTable title="카드별 × 월별 표" description="원본 엑셀의 연간 카드별 지출 시트와 같은 구성이에요. 실제 지출과 참고 거래를 합친 카드 사용액 기준이에요." months={months} rows={matrixRows} monthCount={monthCount} tone="expense" transactionsFor={matrixTransactionsFor} />}
    <section className="tds-card p-5"><h2 className="text-lg font-bold">카드별 상세</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">카드를 누르면 실제 지출·참고 거래를 포함한 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={cardRows} total={usage.total} emptyText="카드로 결제된 거래가 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
  </div>;
}
