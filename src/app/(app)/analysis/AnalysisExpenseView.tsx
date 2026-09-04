'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/transactions';
import type { Budget } from '@/lib/budgets';
import type { CategoryWithSubcategories } from '@/lib/categories';
import { budgetStatus } from '@/lib/budget-calculations';
import { summarizeExpenseByCategory } from '@/lib/analysis';
import { SimpleDrilldown, type TransactionExtraColumn } from './AnalysisDrilldown';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const percent = (value: number | null) => value === null ? '-' : `${(value * 100).toFixed(1)}%`;
const STATUS_LABEL = { safe: '안정', caution: '주의 · 70% 이상', near: '임박 · 90% 이상', over: '초과 · 100% 이상' } as const;
// 예산 소진율 상태는 거래 유형(수입=파랑/지출=빨강)과 다른 축이라 design-system.css의 전용
// --color-status-* 토큰을 쓴다(사용자 지시: "공통 디자인 규칙에 의해서 수정, 없으면 추가") —
// 전에는 --tds-blue-500(수입 색과 동일)을 "안정"에 재사용해서 혼동을 줬었다.
const STATUS_COLOR = { safe: 'text-[var(--color-status-safe)]', caution: 'text-[var(--color-status-caution)]', near: 'text-[var(--color-status-near)]', over: 'text-[var(--color-status-over)]' } as const;

// §8 — 지출 > 대분류 > 개별 거래. 저축성지출은 다른 대분류와 같은 층위의 항목 하나일 뿐이다
// (별도 계층·탭·차트 시리즈로 만들지 않음). 예산 대비 실제 지출도 여기서 보여준다
// (BudgetClosingTab에서 이관된 로직 — §14).
// 2026-09(사용자 지시: "분석쪽 화면 다시 재정리... 월간 누르면... 수입/지출/카드사용/참고거래를
// 하나로 묶은 화면") — 연간 스코프의 엑셀-그대로 표는 AnnualReportView 하나로 통합됐고, 이
// 뷰는 이제 월간 스코프 전용(아코디언 한 칸)이라 연간 매트릭스 히트맵과 scope 분기를 갖지 않는다.
// 2026-09(사용자 지시: "저축성 지출 클릭하면 소분류 컬럼 달아서 쭉 보여줘. 다른 것과 동일하게
// 1단계 구조로 통일") — 대분류→소분류→개별거래 3단계였던 걸 나머지 셋(수입/참고거래/카드사용)과
// 같은 대분류→개별거래 1단계로 바꿨다. 소분류 정보는 사라지지 않고 개별 거래 표의 "소분류"
// 컬럼(extraColumn)으로 옮겼다.
export function AnalysisExpenseView({ month, periodTransactions, categoryNames, subcategoryNames, budgets, categories, totals }: {
  month: string;
  periodTransactions: Transaction[];
  categoryNames: Map<string, string>; subcategoryNames: Map<string, string>;
  budgets: Budget[]; categories: CategoryWithSubcategories[];
  totals: { expense: number };
}) {
  const rows = useMemo(() => summarizeExpenseByCategory(periodTransactions, categoryNames), [periodTransactions, categoryNames]);
  const transactionsFor = (categoryId: string) => periodTransactions.filter((t) => t.status === 'posted' && t.flowClass === 'consumption' && (t.categoryId ?? 'unassigned') === categoryId);
  const extraColumn: TransactionExtraColumn = { label: '소분류', valueFor: (t) => (t.subcategoryId ? subcategoryNames.get(t.subcategoryId) ?? '기타' : '-') };

  const budgetMonth = Number(month.slice(5, 7));
  const budgetByCategory = new Map(budgets.filter((b) => b.month === budgetMonth && b.transactionType === 'expense' && b.categoryId).map((b) => [b.categoryId!, b.amount]));
  const budgetTotal = [...budgetByCategory.values()].reduce((sum, v) => sum + v, 0);
  const spentByCategory = new Map<string, number>();
  for (const t of periodTransactions) { if (t.status === 'posted' && t.flowClass === 'consumption' && t.includeInBudget && t.categoryId) spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount); }
  const budgetedSpent = [...spentByCategory.values()].reduce((sum, v) => sum + v, 0);

  return <div className="analysis-view flex flex-col gap-4">
    <section className="tds-card p-5"><h2 className="text-lg font-bold">지출 대분류</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">대분류를 누르면 개별 거래가 소분류와 함께 펼쳐져요.</p><div className="mt-4"><SimpleDrilldown rows={rows} total={totals.expense} emptyText="지출이 없어요" transactionsFor={transactionsFor} extraColumn={extraColumn} /></div></section>
    <section className="tds-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold">예산 대비 실제 지출</h2><p className="mt-1 text-sm text-[var(--tds-grey-700)]">예산 {won(budgetTotal)} · 실제 {won(budgetedSpent)}</p></div><strong className="text-lg tabular-nums">소진율 {percent(budgetTotal > 0 ? budgetedSpent / budgetTotal : null)}</strong></div>
      <ul className="mt-4 flex flex-col divide-y divide-[var(--tds-grey-200)]">{categories.filter((c) => c.transactionType === 'expense').map((category) => {
        const budget = budgetByCategory.get(category.id) ?? 0; const spent = spentByCategory.get(category.id) ?? 0; if (budget === 0 && spent === 0) return null;
        const state = budgetStatus(spent, budget);
        return <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{category.name}</p><p className={`mt-1 text-xs font-semibold ${STATUS_COLOR[state]}`}>{STATUS_LABEL[state]}</p></div><div className="text-right text-sm tabular-nums"><p>{won(spent)} / {won(budget)}</p><p className="mt-1 text-[var(--tds-grey-500)]">남음 {won(budget - spent)}</p></div></li>;
      })}</ul>
    </section>
  </div>;
}
