'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import { summarizeIncomeBySubcategory } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

// §7 — 수입은 대분류가 하나뿐이라 수입 > 소분류 > 개별 거래로 바로 들어간다.
// 2026-09(사용자 지시): 위쪽 "수입 구성" 막대그래프는 바로 아래 소분류 목록과 값이 완전히
// 겹치는 중복이라 제거했다 — 소분류 목록 자체가 이미 클릭해서 펼치는 인터랙션을 갖고 있다.
export function AnalysisIncomeView({ periodTransactions, subcategoryNames }: {
  scope: 'year' | 'month'; year: string; months: string[];
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeIncomeBySubcategory(periodTransactions, subcategoryNames), [periodTransactions, subcategoryNames]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'income' && (t.subcategoryId ?? 'unassigned') === id);
  const extraColumn: TransactionExtraColumn = { label: '소분류', valueFor: (t) => (t.subcategoryId ? subcategoryNames.get(t.subcategoryId) ?? '기타 수입' : '-') };
  return <div className="analysis-view flex flex-col gap-4">
    <section className="tds-card p-5"><h2 className="text-lg font-bold">수입 소분류</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">항목을 누르면 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={rows} total={total} emptyText="수입이 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
  </div>;
}
