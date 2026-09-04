'use client';

import { useMemo } from 'react';
import { EmptyState } from '@/components/EmptyState';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { Transaction } from '@/lib/transactions';
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
// 엑셀 탭 순서 그대로 배치한다. 연 단위 데이터라 scope==='month'에서는 의미가 없어 안내만 보여준다.
export function AnnualReportView({ scope, year, months, periodTransactions, categories, paymentMethods }: {
  scope: 'year' | 'month';
  year: string;
  months: string[];
  periodTransactions: Transaction[];
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const incomeCategory = categories.find((c) => c.transactionType === 'income');
  const expenseCategories = useMemo(() => categories.filter((c) => c.transactionType === 'expense'), [categories]);

  const incomeRows = useMemo(() => buildAnnualIncomeReport(periodTransactions, months, incomeCategory), [periodTransactions, months, incomeCategory]);
  const cardRows = useMemo(() => buildAnnualCardReport(periodTransactions, months, paymentMethods), [periodTransactions, months, paymentMethods]);
  const expenseCategoryRows = useMemo(() => buildAnnualExpenseCategoryReport(periodTransactions, months, expenseCategories), [periodTransactions, months, expenseCategories]);
  const expenseDetailRows = useMemo(() => buildAnnualExpenseDetailReport(periodTransactions, months, expenseCategories), [periodTransactions, months, expenseCategories]);

  if (scope !== 'year') {
    return <section className="tds-card p-5"><EmptyState title="연간 보기에서 확인할 수 있어요" description="상단에서 [연간]을 선택하면 원본 엑셀과 같은 구조의 연간 리포트 4종을 볼 수 있어요." /></section>;
  }

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
      description="원본 엑셀 [연간_항목별수입]과 같은 구조예요. 급여·수당·상여는 주소득, 나머지는 부소득으로 묶어요(거래 등록 시 고르는 '거래 구분'과는 다른 분류예요)."
      months={months} rows={incomeRows} tone="income" transactionsFor={incomeTransactionsFor}
    />
    <AnnualReportTable
      title={`${year}년 카드별 지출`}
      description="원본 엑셀 [연간_카드별지출]과 같은 구조예요. 계좌이체·현금·카드·상품권까지 등록된 모든 결제수단을 보여줘요."
      months={months} rows={cardRows} tone="expense" transactionsFor={cardTransactionsFor}
    />
    <AnnualReportTable
      title={`${year}년 항목별 지출`}
      description="원본 엑셀 [연간_항목별지출]과 같은 구조예요. 저축성지출과 나머지 전체(소비성지출)를 나누고, 대분류별로 보여줘요."
      months={months} rows={expenseCategoryRows} tone="expense" transactionsFor={expenseCategoryTransactionsFor}
    />
    <AnnualReportTable
      title={`${year}년 세부항목별 지출`}
      description="원본 엑셀 [연간_세부항목별지출]과 같은 구조예요. 항목별 지출과 데이터 단위가 달라요 — 대분류 아래 소분류까지 모두 펼쳐서 보여줘요."
      months={months} rows={expenseDetailRows} tone="expense" showGroupColumn transactionsFor={expenseDetailTransactionsFor}
    />
  </div>;
}
