'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import { summarizeIncomeBySubcategory } from '@/lib/analysis';
import { AnalysisBarChart } from './AnalysisBarChart';
import { SimpleDrilldown } from './AnalysisDrilldown';

// §7 — 수입은 대분류가 하나뿐이라 수입 > 소분류 > 개별 거래로 바로 들어간다.
export function AnalysisIncomeView({ periodTransactions, subcategoryNames }: {
  scope: 'year' | 'month'; year: string; months: string[];
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeIncomeBySubcategory(periodTransactions, subcategoryNames), [periodTransactions, subcategoryNames]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'income' && (t.subcategoryId ?? 'unassigned') === id);
  return <div className="analysis-view flex flex-col gap-4">
    <AnalysisBarChart title="수입 구성" description="소분류별 금액과 비중이에요." rows={rows} tone="income" />
    <section className="tds-card p-5"><h2 className="text-lg font-bold">수입 소분류</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">항목을 누르면 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={rows} total={total} emptyText="수입이 없어요" transactionsFor={transactionsFor} /></div></section>
  </div>;
}
