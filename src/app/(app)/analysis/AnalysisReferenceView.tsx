'use client';

import { useMemo } from 'react';
import { Amount } from '@/components/Amount';
import { SectionHeader } from '@/components/SectionHeader';
import { StatCard } from '@/components/StatCard';
import type { Transaction } from '@/lib/transactions';
import { summarizeReferenceByPaymentMethod } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

export function AnalysisReferenceView({ periodTransactions, paymentMethodNames, subcategoryNames }: {
  periodTransactions: Transaction[];
  paymentMethodNames: Map<string, string>;
  subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeReferenceByPaymentMethod(periodTransactions, paymentMethodNames), [periodTransactions, paymentMethodNames]);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const count = periodTransactions.filter((transaction) => transaction.status === 'posted' && transaction.transactionType === 'reference').length;
  const transactionsFor = (id: string) => periodTransactions.filter((transaction) => transaction.status === 'posted' && transaction.transactionType === 'reference' && (transaction.paymentMethodId ?? 'unassigned') === id);
  const extraColumn: TransactionExtraColumn = { label: '소분류', valueFor: (transaction) => (transaction.subcategoryId ? subcategoryNames.get(transaction.subcategoryId) ?? '기타' : '-') };

  return (
    <div className="analysis-view flex flex-col gap-4">
      <section className="tds-card tds-section-card">
        <SectionHeader title="참고 거래" description="수입·지출·순현금흐름에 포함하지 않는 거래예요." />
        <div className="tds-summary-grid">
          <StatCard label="참고 거래 건수" value={<span className="tabular-nums">{count}건</span>} />
          <StatCard label="참고 거래 총액" value={<Amount value={total} size="medium" />} />
        </div>
        <p className="text-xs text-[var(--tds-grey-500)]">결제수단이 카드면 카드 사용 영역의 카드 사용액에는 함께 반영돼요.</p>
      </section>

      <section className="tds-card tds-section-card">
        <SectionHeader title="결제수단별 참고 거래" description="항목을 누르면 개별 거래를 확인할 수 있어요." />
        <div><SimpleDrilldown rows={rows} total={total} emptyText="참고 거래가 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div>
      </section>
    </div>
  );
}
