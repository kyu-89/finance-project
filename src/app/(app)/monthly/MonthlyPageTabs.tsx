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
    <section className="monthly-command-center" aria-label="이번 달 요약">
      <div className="monthly-summary-grid">
        <Summary label="수입" value={income} tone="income" />
        <Summary label="지출" value={expense} tone="expense" />
        <Summary label="저축성 지출" value={savings} tone="expense" />
        <Summary label="순현금흐름" value={income - expense} tone={income - expense >= 0 ? 'income' : 'expense'} />
      </div>
      <div className="monthly-command-meta">
        <article className="monthly-priority-card is-planned"><span>예정 거래</span><strong>{plannedRows.length}건</strong><small>{plannedAmount > 0 ? `${plannedAmount.toLocaleString('ko-KR')}원 · 확정 또는 제외할 거래` : '확정할 거래가 없어요'}</small></article>
        <article className="monthly-priority-card is-reference"><span>참고 거래</span><strong>{referenceCount}건</strong><small>수입·지출 합계와 분리해서 관리해요</small></article>
        <Link href={`/analysis?scope=month&month=${selectedMonth}&type=expense`} prefetch className="monthly-analysis-cta">수입·지출 분석 보기 →</Link>
      </div>
    </section>
    <section className="monthly-workspace" aria-label="월간 관리 작업"><div className="monthly-workspace-content" role="tabpanel"><MonthlyInputTab initialTransactions={transactions} selectedMonth={selectedMonth} categories={categories} paymentMethods={paymentMethods} /></div></section>
  </div>;
}

function Summary({ label, value, suffix = '원', tone, detail }: { label: string; value: number; suffix?: string; tone: 'income' | 'expense' | 'planned'; detail?: string }) { return <article className={`monthly-summary-card is-${tone}`}><span>{label}</span><strong>{value.toLocaleString('ko-KR')}{suffix}</strong>{detail && <small>{detail}</small>}</article>; }
