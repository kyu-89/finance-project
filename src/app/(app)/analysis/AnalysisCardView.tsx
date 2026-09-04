'use client';

import { useMemo } from 'react';
import { Amount } from '@/components/Amount';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { Transaction } from '@/lib/transactions';
import { summarizeCardUsage, type AnalysisRow } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

export function AnalysisCardView({ periodTransactions, paymentMethods, categoryNames }: {
  periodTransactions: Transaction[];
  paymentMethods: PaymentMethod[];
  categoryNames: Map<string, string>;
}) {
  const usage = useMemo(() => summarizeCardUsage(periodTransactions, paymentMethods), [periodTransactions, paymentMethods]);
  const cardRows: AnalysisRow[] = usage.cards.map((card) => ({ id: card.id, label: card.label, value: card.totalAmount, count: card.count }));
  const transactionsFor = (id: string) => periodTransactions.filter((transaction) => transaction.status === 'posted' && transaction.paymentMethodId === id && (transaction.flowClass === 'consumption' || transaction.transactionType === 'reference'));
  const creditShare = usage.total > 0 ? usage.creditTotal / usage.total : 0;
  const extraColumn: TransactionExtraColumn = { label: '카테고리', valueFor: (transaction) => (transaction.categoryId ? categoryNames.get(transaction.categoryId) ?? '기타' : '-') };

  return (
    <div className="analysis-view flex flex-col gap-4">
      <section className="tds-card tds-section-card">
        <SectionHeader title="전체 카드 사용액" description="카드 사용액은 가구 총지출과 다른 개념이에요." />
        <div className="tds-summary-grid">
          <StatCard label="실제 지출 카드 사용액" value={<Amount value={usage.totalExpense} type="expense" size="medium" />} />
          <StatCard label="참고 거래 카드 사용액" value={<Amount value={usage.totalReference} size="medium" />} />
          <StatCard label="전체 카드 사용액" value={<Amount value={usage.total} size="medium" />} />
        </div>
        <p className="text-xs text-[var(--tds-grey-500)]">참고 거래 카드 사용액은 총지출에 포함하지 않아요. 신용카드 {(creditShare * 100).toFixed(0)}% · 체크카드 {((1 - creditShare) * 100).toFixed(0)}%</p>
      </section>

      <section className="tds-card tds-section-card">
        <SectionHeader title="카드별 상세" description="카드를 누르면 실제 지출·참고 거래를 포함한 개별 거래를 확인할 수 있어요." />
        <div><SimpleDrilldown rows={cardRows} total={usage.total} emptyText="카드로 결제된 거래가 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div>
      </section>
    </div>
  );
}
