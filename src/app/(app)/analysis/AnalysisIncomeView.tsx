'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import { reportMonthOf, summarizeIncomeBySubcategory, summarizeIncomeMatrix } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';
import { AnalysisHeatmapTable } from './AnalysisHeatmapTable';

// §7 — 수입은 대분류가 하나뿐이라 수입 > 소분류 > 개별 거래로 바로 들어간다.
// 2026-09(사용자 지시): 위쪽 "수입 구성" 막대그래프는 바로 아래 소분류 목록과 값이 완전히
// 겹치는 중복이라 제거했다 — 소분류 목록 자체가 이미 클릭해서 펼치는 인터랙션을 갖고 있다.
export function AnalysisIncomeView({ scope, months, monthCount, periodTransactions, subcategoryNames }: {
  scope: 'year' | 'month'; year: string; months: string[]; monthCount: number;
  periodTransactions: Transaction[]; allTransactions: Transaction[];
  subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeIncomeBySubcategory(periodTransactions, subcategoryNames), [periodTransactions, subcategoryNames]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'income' && (t.subcategoryId ?? 'unassigned') === id);
  const extraColumn: TransactionExtraColumn = { label: '소분류', valueFor: (t) => (t.subcategoryId ? subcategoryNames.get(t.subcategoryId) ?? '기타 수입' : '-') };
  // §12 — 원본 엑셀 연간_항목별수입과 대응하는 소분류 × 12개월 표. 연간 스코프에서만 보여준다.
  const matrixRows = useMemo(() => scope === 'year' ? summarizeIncomeMatrix(periodTransactions, months, subcategoryNames) : [], [scope, periodTransactions, months, subcategoryNames]);
  const matrixTransactionsFor = (id: string, month: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'income' && (t.subcategoryId ?? 'unassigned') === id && reportMonthOf(t) === month);
  return <div className="analysis-view flex flex-col gap-4">
    {scope === 'year' && <AnalysisHeatmapTable title="수입 소분류 × 월별 표" description="원본 엑셀의 연간 항목별 수입 시트와 같은 구성이에요. 셀을 누르면 개별 거래를 볼 수 있어요." months={months} rows={matrixRows} monthCount={monthCount} tone="income" transactionsFor={matrixTransactionsFor} />}
    <section className="tds-card p-5"><h2 className="text-lg font-bold">수입 소분류</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">항목을 누르면 개별 거래를 확인할 수 있어요.</p><div className="mt-4"><SimpleDrilldown rows={rows} total={total} emptyText="수입이 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
  </div>;
}
