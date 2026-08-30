'use client';

import { useMemo, useState } from 'react';
import type { Transaction } from '@/lib/transactions';
import { calculateTransactionTotals } from '@/lib/transaction-totals';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';
import type { SupportDetail, EventDetail } from '@/lib/transaction-details';
import type { HouseholdMember } from '@/lib/household';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import type { DuplicateCandidate } from '@/lib/recurring-duplicates';
import { RefundParentLinkPanel } from './RefundParentLinkPanel';

const STATUS_LABEL: Record<Transaction['status'], string> = {
  planned: '예정',
  posted: '확정',
  skipped: '건너뜀',
  cancelled: '취소',
};
const TYPE_LABEL: Record<Transaction['transactionType'], string> = { income: '수입', expense: '지출', saving: '저축', investment: '투자', debt_principal: '대출원금', finance_cost: '금융비용', transfer: '이체', asset_adjustment: '자산조정', refund: '환불' };

export function AllTransactionsTab({ initialTransactions, supportDetails, eventDetails, members, categories, paymentMethods, duplicateCandidates }: { initialTransactions: Transaction[]; supportDetails: Record<string, SupportDetail>; eventDetails: Record<string, EventDetail>; members: HouseholdMember[]; categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; duplicateCandidates: Record<string, DuplicateCandidate[]> }) {
  const [statusFilter, setStatusFilter] = useState<Transaction['status'] | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<Transaction['transactionType'] | 'all'>('all');
  const [costFilter, setCostFilter] = useState<'all' | 'fixed' | 'variable'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);

  const filtered = useMemo(
    () => initialTransactions.filter((t) => {
      const text = query.trim().toLowerCase();
      const tag = tagQuery.trim().toLowerCase();
      const memberMatch = memberFilter === 'all' || (memberFilter === 'unassigned' ? !t.payerMemberId && !t.beneficiaryMemberId : t.payerMemberId === memberFilter || t.beneficiaryMemberId === memberFilter);
      return (statusFilter === 'all' || t.status === statusFilter) && (typeFilter === 'all' || t.transactionType === typeFilter) && (costFilter === 'all' || t.costBehavior === costFilter) && (categoryFilter === 'all' || t.categoryId === categoryFilter || t.subcategoryId === categoryFilter) && (paymentFilter === 'all' || t.paymentMethodId === paymentFilter) && memberMatch && (!text || `${t.description} ${t.memo ?? ''}`.toLowerCase().includes(text)) && (!tag || (t.tags ?? []).some((value) => value.toLowerCase().includes(tag))) && (!fromDate || t.transactionDate >= fromDate) && (!toDate || t.transactionDate <= toDate) && (!minAmount || t.amount >= Number(minAmount)) && (!maxAmount || t.amount <= Number(maxAmount));
    }),
    [initialTransactions, statusFilter, typeFilter, costFilter, categoryFilter, paymentFilter, memberFilter, query, tagQuery, fromDate, toDate, minAmount, maxAmount],
  );

  const { consumptionTotal, plannedTotal } = calculateTransactionTotals(filtered);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 rounded-2xl bg-[var(--tds-grey-100)] p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="내용·메모 검색" className="px-3" />
        <input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="태그 검색" className="px-3" />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="시작일" className="px-3" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="종료일" className="px-3" />
        <div className="grid grid-cols-2 gap-2"><input type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="최소 금액" className="px-3 text-right" /><input type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="최대 금액" className="px-3 text-right" /></div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="px-3"><option value="all">모든 유형</option>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={costFilter} onChange={(e) => setCostFilter(e.target.value as typeof costFilter)} className="px-3"><option value="all">모든 비용성격</option><option value="fixed">고정비</option><option value="variable">변동비</option></select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3"><option value="all">모든 카테고리</option>{categories.map((category) => <optgroup key={category.id} label={category.name}><option value={category.id}>{category.name}</option>{category.subcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>)}</select>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3"><option value="all">모든 결제수단</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select>
        <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className="px-3"><option value="all">모든 구성원</option><option value="unassigned">미지정</option>{members.filter((member) => member.isActive).map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['all', 'planned', 'posted', 'skipped', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            data-selected={statusFilter === status}
            className="tds-chip px-4"
          >
            {status === 'all' ? '전체' : STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <div className="table-surface overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3">날짜</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">내용</th>
              <th className="px-4 py-3">유형</th><th className="px-4 py-3 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((transaction) => (
              <tr key={transaction.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{transaction.transactionDate}</td>
                <td className="px-4 py-3">{STATUS_LABEL[transaction.status]}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => setSelected(transaction)} className="text-left font-semibold text-[var(--tds-blue-600)] hover:underline">{transaction.description}</button><p className="text-xs text-[var(--tds-grey-500)]">{categories.flatMap((category) => [category, ...category.subcategories]).find((item) => item.id === (transaction.subcategoryId ?? transaction.categoryId))?.name ?? '미분류'}</p>{transaction.tags?.length ? <p className="mt-1 text-xs text-[var(--tds-blue-600)]">{transaction.tags.map((tag) => `#${tag}`).join(' ')}</p> : null}</td>
                <td className="px-4 py-3">{TYPE_LABEL[transaction.transactionType]}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{transaction.amount.toLocaleString('ko-KR')}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <TransactionDetailDrawer transaction={selected} support={supportDetails[selected.id]} event={eventDetails[selected.id]} members={members} candidates={duplicateCandidates[selected.id]} onClose={() => setSelected(null)} />}
      {selected?.transactionType === 'refund' && <RefundParentLinkPanel transaction={selected} transactions={initialTransactions} onClose={() => setSelected(null)} />}

      <div className="tds-card flex flex-col items-end gap-1 p-4 text-sm">
        <p className="font-medium">
          소비 합계 (확정): {consumptionTotal.toLocaleString('ko-KR')}원
        </p>
        {plannedTotal > 0 && (
          <p className="text-gray-500">
            예정 (실적 미포함): {plannedTotal.toLocaleString('ko-KR')}원
          </p>
        )}
      </div>
    </div>
  );
}
