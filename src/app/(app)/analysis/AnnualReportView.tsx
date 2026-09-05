'use client';

import { useMemo } from 'react';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { TransactionSummary } from '@/lib/transactions';
import { isExpense, isIncome, isReference, reportMonthOf } from '@/lib/analysis';
import {
  buildAnnualCardReport,
  buildAnnualExpenseCategoryReport,
  buildAnnualExpenseDetailReport,
  buildAnnualIncomeReport,
  type AnnualReportRow,
} from '@/lib/annual-report';
import { AnnualReportTable } from './AnnualReportTable';

// §12 — "연간 리포트"(사용자 지시: "연간 리포트라는 별도 섹션이 좋을 것 같아"). 원본 엑셀의
// [연간_항목별수입]/[연간_카드별지출]/[연간_항목별지출]/[연간_세부항목별지출] 4개 시트를 그
// 엑셀 탭 순서 그대로 배치한다.
// 2026-09(사용자 지시: "분석쪽 화면 다시 재정리... 연간 탭 누르면 이번에 개편한 연간 리포트
// 화면이 바로 표시되고... 수입/지출/참고거래/카드사용 등 영역과 기능 모두 삭제") — 연간
// 스코프의 유일한 콘텐츠가 됐으므로 scope==='month' 안내 분기를 갖지 않는다(AnalysisWorkspace가
// scope==='year'일 때만 이 컴포넌트를 마운트한다).
export function AnnualReportView({ year, months, periodTransactions, categories, paymentMethods }: {
  year: string;
  months: string[];
  periodTransactions: TransactionSummary[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const incomeCategory = categories.find((c) => c.transactionType === 'income');
  const expenseCategories = useMemo(() => categories.filter((c) => c.transactionType === 'expense'), [categories]);

  const incomeRows = useMemo(() => buildAnnualIncomeReport(periodTransactions, months, incomeCategory), [periodTransactions, months, incomeCategory]);
  const cardRows = useMemo(() => buildAnnualCardReport(periodTransactions, months, paymentMethods), [periodTransactions, months, paymentMethods]);
  const expenseCategoryRows = useMemo(() => buildAnnualExpenseCategoryReport(periodTransactions, months, expenseCategories), [periodTransactions, months, expenseCategories]);
  const expenseDetailRows = useMemo(() => buildAnnualExpenseDetailReport(periodTransactions, months, expenseCategories), [periodTransactions, months, expenseCategories]);

  const incomeTransactionsFor = (row: AnnualReportRow, month: string) =>
    periodTransactions.filter((t) => isIncome(t) && (t.subcategoryId ?? 'unassigned') === row.id && reportMonthOf(t) === month);
  const cardTransactionsFor = (row: AnnualReportRow, month: string) =>
    periodTransactions.filter((t) => t.paymentMethodId === row.id && (isExpense(t) || isReference(t)) && reportMonthOf(t) === month);
  const expenseCategoryTransactionsFor = (row: AnnualReportRow, month: string) =>
    periodTransactions.filter((t) => isExpense(t) && (t.categoryId ?? 'unassigned') === row.id && reportMonthOf(t) === month);
  const expenseDetailTransactionsFor = (row: AnnualReportRow, month: string) =>
    periodTransactions.filter((t) => isExpense(t) && (t.subcategoryId ?? 'unassigned') === row.id && reportMonthOf(t) === month);

  return <div className="flex flex-col gap-5">
    <AnnualReportTable
      title={`${year}년 항목별 수입`}
      description="급여·수당·상여는 주소득, 나머지는 부소득으로 묶어요(거래 등록 시 고르는 '거래 구분'과는 다른 분류예요)."
      months={months} rows={incomeRows} tone="income" transactionsFor={incomeTransactionsFor}
    />
    <AnnualReportTable
      title={`${year}년 카드별 지출`}
      description="원본 엑셀 [연간_카드별지출]과 같은 구조예요. 계좌이체·현금·카드·상품권까지 등록된 모든 결제수단을 보여줘요."
      months={months} rows={cardRows} tone="expense" transactionsFor={cardTransactionsFor}
    />
    <AnnualReportTable
      title={`${year}년 항목별 지출`}
      description="원본 엑셀 [연간_항목별지출]과 같은 구조예요. 지출을 대분류별로 나누고, 각 항목의 소분류와 금액을 보여줘요."
      months={months} rows={expenseCategoryRows} tone="expense" transactionsFor={expenseCategoryTransactionsFor}
    />
    <AnnualReportTable
      title={`${year}년 세부항목별 지출`}
      description="원본 엑셀 [연간_세부항목별지출]과 같은 구조예요. 항목별 지출과 데이터 단위가 달라요 — 대분류 아래 소분류까지 모두 펼쳐서 보여줘요."
      months={months} rows={expenseDetailRows} tone="expense" showGroupColumn transactionsFor={expenseDetailTransactionsFor}
    />
  </div>;
}
