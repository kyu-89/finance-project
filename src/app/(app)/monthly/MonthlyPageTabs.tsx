'use client';

import Link from 'next/link';
import { MonthlyInputTab } from './MonthlyInputTab';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';

// 2026-09: 대시보드/분석/월간관리 정보구조 재정리(사용자 지시) — 월간관리에는 입력·처리 기능만
// 남긴다. "수입·지출 분석" 탭(BudgetClosingTab)은 분석 로직 자체는 지우지 않고 /analysis의
// 월간 지출 탭(예산 대비 실제 지출)으로 그대로 옮겼고, 여기는 그 화면으로 가는 CTA만 남는다.
export function MonthlyPageTabs({ transactions, selectedMonth, categories, paymentMethods }: { transactions: Transaction[]; selectedMonth: string; categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[] }) {
  const posted = transactions.filter((transaction) => transaction.status === 'posted');
  const income = posted.filter((transaction) => transaction.transactionType === 'income').reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = posted.filter((transaction) => transaction.transactionType === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0);
  const savingsCategoryId = categories.find((c) => c.name === '저축성지출')?.id;
  const savings = savingsCategoryId ? posted.filter((t) => t.transactionType === 'expense' && t.categoryId === savingsCategoryId).reduce((sum, t) => sum + t.amount, 0) : 0;
  const plannedRows = transactions.filter((transaction) => transaction.status === 'planned');
  const plannedAmount = plannedRows.reduce((sum, t) => sum + t.amount, 0);
  const referenceCount = posted.filter((t) => t.transactionType === 'reference').length;
  return <div className="monthly-page-flow flex flex-col gap-4">
    <section className="monthly-command-center" aria-label="이번 달 요약"><div className="monthly-command-copy"><p className="monthly-kicker">이번 달 흐름 보기</p><h2>이번 달의 자금 흐름을 정리해요</h2><p>선택한 연월의 확정 거래와 예정 거래를 구분해 보여드려요. 예정 거래를 먼저 처리하고 수입·지출을 추가해 보세요.</p></div>
      <div className="monthly-summary-grid">
        <Summary label="이번 달 수입" value={income} tone="income" />
        <Summary label="이번 달 총지출" value={expense} tone="expense" />
        <Summary label="저축성 지출" value={savings} tone="expense" />
        <Summary label="순현금흐름" value={income - expense} tone={income - expense >= 0 ? 'income' : 'expense'} />
        <Summary label="처리할 예정" value={plannedRows.length} suffix="건" tone="planned" detail={plannedAmount > 0 ? `${plannedAmount.toLocaleString('ko-KR')}원` : undefined} />
        <Summary label="참고 거래" value={referenceCount} suffix="건" tone="planned" />
      </div>
      <Link href={`/analysis?scope=month&month=${selectedMonth}&type=expense`} prefetch className="monthly-analysis-cta">이번 달 분석 보기 →</Link>
    </section>
    <section className="monthly-workspace" aria-label="월간 관리 작업"><div className="monthly-workspace-content" role="tabpanel"><MonthlyInputTab initialTransactions={transactions} selectedMonth={selectedMonth} categories={categories} paymentMethods={paymentMethods} /></div></section>
  </div>;
}

function Summary({ label, value, suffix = '원', tone, detail }: { label: string; value: number; suffix?: string; tone: 'income' | 'expense' | 'planned'; detail?: string }) { return <article className={`monthly-summary-card is-${tone}`}><span>{label}</span><strong>{value.toLocaleString('ko-KR')}{suffix}</strong>{detail && <small>{detail}</small>}</article>; }
