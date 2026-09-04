'use client';

import { useMemo } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import type { Transaction } from '@/lib/transactions';
import { summarizeIncomeBySubcategory } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

// §7 — 수입은 대분류가 하나뿐이라 수입 > 소분류 > 개별 거래로 바로 들어간다.
// 2026-09(사용자 지시): 위쪽 "수입 구성" 막대그래프는 바로 아래 소분류 목록과 값이 완전히
// 겹치는 중복이라 제거했다 — 소분류 목록 자체가 이미 클릭해서 펼치는 인터랙션을 갖고 있다.
// 2026-09(사용자 지시: "분석쪽 화면 다시 재정리... 월간 누르면... 수입/지출/카드사용/참고거래를
// 하나로 묶은 화면") — 연간 스코프의 엑셀-그대로 표는 AnnualReportView 하나로 통합됐고, 이
// 뷰는 이제 월간 스코프 전용(아코디언 한 칸)이라 연간 매트릭스 히트맵을 가지고 있지 않는다.
export function AnalysisIncomeView({ periodTransactions, subcategoryNames }: {
  periodTransactions: Transaction[];
  subcategoryNames: Map<string, string>;
}) {
  const rows = useMemo(() => summarizeIncomeBySubcategory(periodTransactions, subcategoryNames), [periodTransactions, subcategoryNames]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const transactionsFor = (id: string) => periodTransactions.filter((t) => t.status === 'posted' && t.transactionType === 'income' && (t.subcategoryId ?? 'unassigned') === id);
  // 2026-09(사용자 지시: "컬럼이나 디자인 시스템이 일관되지 않아") — 소분류를 못 찾았을 때의
  // 대체 문구를 지출·참고거래와 똑같이 "기타"로 맞췄다(전에는 여기만 "기타 수입"이었다).
  const extraColumn: TransactionExtraColumn = { label: '소분류', valueFor: (t) => (t.subcategoryId ? subcategoryNames.get(t.subcategoryId) ?? '기타' : '-') };
  return <div className="analysis-view flex flex-col gap-4">
    <section className="tds-card tds-section-card"><SectionHeader title="수입 소분류" description="항목을 누르면 개별 거래를 확인할 수 있어요." /><div><SimpleDrilldown rows={rows} total={total} emptyText="수입이 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
  </div>;
}
