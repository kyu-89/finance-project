'use client';

import { useMemo, useState } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import {
  updateCostBehaviorAction,
} from '@/actions/transaction-actions';
import { AddDrawer } from '@/components/Drawer';
import { InlineActionSelect } from '@/components/InlineActionSelect';
import type { Transaction } from '@/lib/transactions';
import type { CategoryWithSubcategories } from '@/lib/categories';
import type { PaymentMethod } from '@/lib/payment-methods';
import { MonthlyDrawerForm as MonthlyRowForm } from './MonthlyDrawerForm';
import { TransactionStatusEditor } from '@/components/TransactionStatusEditor';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';
import { findRecurringDuplicateCandidates, type DuplicateCandidate } from '@/lib/recurring-duplicates';
import { SectionHeader } from '@/components/SectionHeader';

// No optional row models (sorting/filtering/etc.) are needed for this first-pass read-only
// table, so the feature registry is empty — the core row model is automatic in v9.
const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Transaction>();
const TRANSACTION_TYPE_LABEL: Record<Transaction['transactionType'], string> = { income: '수입', expense: '지출', reference: '참고 거래' };
// 2026-09(사용자 지시): "'거래 구분' 컬럼 넣으라고 했잖아. '유형' 컬럼 우측에" — income_group/
// expense_group을 유형 칸 안에 끼워 넣는 대신, "유형" 바로 오른쪽의 독립된 "거래 구분" 컬럼으로
// 보여준다(makeColumns의 transactionGroup 컬럼). 모바일 카드에서는 그 컬럼 셀을 유형 셀과 같은
// 그리드 칸(2행 1열)에 justify-self로 나란히 배치해 "지출/수입 옆에 나란히" 보이게 한다
// (design-system.css의 [data-table-field='transactionGroup'] 참고).
const INCOME_GROUP_LABEL: Record<'fixed' | 'additional', string> = { fixed: '고정 수입', additional: '부가 수입' };
const EXPENSE_GROUP_LABEL: Record<'savings' | 'consumption', string> = { savings: '저축성 지출', consumption: '소비성 지출' };
function groupLabelFor(transaction: Transaction): string | null {
  if (transaction.transactionType === 'income' && transaction.incomeGroup) return INCOME_GROUP_LABEL[transaction.incomeGroup];
  if (transaction.transactionType === 'expense' && transaction.expenseGroup) return EXPENSE_GROUP_LABEL[transaction.expenseGroup];
  return null;
}
const COST_BEHAVIOR_LABEL: Record<NonNullable<Transaction['costBehavior']>, string> = { fixed: '고정비', variable: '변동비' };
const COST_BEHAVIOR_OPTIONS = [
  { value: '', label: '미지정' },
  { value: 'fixed', label: COST_BEHAVIOR_LABEL.fixed },
  { value: 'variable', label: COST_BEHAVIOR_LABEL.variable },
] as const;


function CostBehaviorEditor({ transaction }: { transaction: Transaction }) {
  return <InlineActionSelect
    action={updateCostBehaviorAction}
    id={transaction.id}
    label={`${transaction.description} 비용성격`}
    name="costBehavior"
    value={transaction.costBehavior ?? ''}
    options={COST_BEHAVIOR_OPTIONS}
    hiddenFields={{ id: transaction.id }}
    className="transaction-inline-editor"
    selectClassName="tds-inline-select transaction-inline-select"
    feedback="compact"
  />;
}

function TransactionAddChooser({ categories, paymentMethods }: { categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[] }) {
  const [transactionType, setTransactionType] = useState<Transaction['transactionType'] | null>(null);
  return transactionType ? (
    <div className="monthly-add-chooser-form">
      <button type="button" className="monthly-add-chooser-back" onClick={() => setTransactionType(null)}>← 거래 유형 다시 선택</button>
      <MonthlyRowForm initialTransactionType={transactionType} categories={categories} paymentMethods={paymentMethods} />
    </div>
  ) : (
    <div className="monthly-add-chooser" aria-label="거래 유형 선택">
      <p>기록할 거래 유형을 선택해 주세요.</p>
      <div className="monthly-add-chooser-options">
        {(['income', 'expense', 'reference'] as const).map((type) => (
          <button key={type} type="button" className={`monthly-add-option is-${type}`} onClick={() => setTransactionType(type)}>
            <strong>{TRANSACTION_TYPE_LABEL[type]}</strong>
            <span>{type === 'income' ? '들어온 돈' : type === 'expense' ? '쓴 돈' : '참고로 남길 거래'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Column order is a shared rule, not a per-screen choice: 날짜 · 유형 · 거래 구분 ·
// 대분류 · 소분류 · 내용 · 금액 · 결제수단 · 비고 · 성격 · 상태. The desktop table's columns
// and the mobile card's row groups (see .tds-ledger-table in design-system.css) both
// follow this order; --ui-ledger-columns there must stay in this same sequence.
function makeColumns() {
  return columnHelper.columns([
    columnHelper.accessor('transactionDate', { header: '날짜' }),
    columnHelper.accessor('transactionType', { header: '유형', cell: (info) => TRANSACTION_TYPE_LABEL[info.getValue()] }),
    columnHelper.display({ id: 'transactionGroup', header: '거래 구분', cell: (info) => groupLabelFor(info.row.original) }),
    columnHelper.accessor('categoryId', { header: '대분류', cell: () => null }),
    columnHelper.accessor('subcategoryId', { header: '소분류', cell: () => null }),
    columnHelper.accessor('description', { header: '내용' }),
    columnHelper.accessor('amount', { header: '금액', cell: (info) => `${info.getValue().toLocaleString('ko-KR')}원` }),
    columnHelper.accessor('paymentMethodId', { header: '결제수단', cell: () => null }),
    columnHelper.accessor('memo', { header: '비고', cell: (info) => info.getValue() ?? '' }),
    columnHelper.accessor('costBehavior', { header: '성격', cell: (info) => <CostBehaviorEditor key={info.row.original.id} transaction={info.row.original} /> }),
    columnHelper.accessor('status', { header: '상태', cell: (info) => <TransactionStatusEditor key={info.row.original.id} transaction={info.row.original} /> }),
  ]);
}

function MonthlyTransactionTable({ transactions, categories, paymentMethods, duplicateCandidates }: { transactions: Transaction[]; categories: CategoryWithSubcategories[]; paymentMethods: PaymentMethod[]; duplicateCandidates: Record<string, DuplicateCandidate[]> }) {
  const pageSize = 50;
  const [page, setPage] = useState(1);
  const columns = useMemo(() => makeColumns(), []);
  const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageTransactions = useMemo(() => transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize), [transactions, currentPage]);
  // getRowId 없이는 tanstack-table이 배열 인덱스를 row.id로 쓴다 — 반복항목 자동 생성으로
  // 새 예정 거래가 앞쪽 날짜에 끼어들면 그 뒤 모든 행의 인덱스가 밀리면서, 같은 표 위치(같은
  // key)가 다른 거래를 가리키게 된다. 그 결과 방금 상태를 바꾼 행의 select가 실제로는 그
  // 자리로 밀려온 "새로 생성된 예정 거래"를 보여주는 것처럼 보여서 "무슨 상태로 바꿔도 예정으로
  // 되돌아간다"는 버그로 나타났다(사용자 지시로 조사·수정). 거래의 실제 id를 행 식별자로 고정한다.
  const table = useTable({ features, columns, data: pageTransactions, getRowId: (row: Transaction) => row.id });
  const categoryById = useMemo(() => new Map(categories.flatMap((category) => [category, ...category.subcategories]).map((item) => [item.id, item.name])), [categories]);
  const paymentMethodById = useMemo(() => new Map(paymentMethods.map((method) => [method.id, method.name])), [paymentMethods]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  return <div className="table-surface"><table className="tds-data-table tds-ledger-table monthly-input-table border-collapse"><thead>{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id} className="border-b text-left">{headerGroup.headers.map((header) => <th key={header.id} data-table-field={header.column.id} data-table-align={header.column.id === 'amount' ? 'right' : ['transactionDate', 'status', 'transactionType', 'transactionGroup', 'costBehavior'].includes(header.column.id) ? 'center' : undefined} className="tds-table-cell">{header.isPlaceholder ? null : <table.FlexRender header={header} />}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => {
        const transaction = row.original;
        // 행 전체를 클릭하면 상세 드로어가 열려야 한다(사용자 지시: "거래의 건을 클릭하면 수정할
        // 수 있어야해") — 단, 성격/상태 칸의 select·button은 그 자체로 즉시 저장되는 인라인
        // 편집기라 클릭이 그 조작으로만 끝나야 한다(드로어가 함께 열리면 안 됨).
        const openDetail = (event: React.MouseEvent<HTMLTableRowElement>) => {
          if ((event.target as HTMLElement).closest('select, button, a, input, textarea, label')) return;
          setSelected(transaction);
        };
        return <tr key={row.id} className="tds-table-row border-b last:border-b-0" data-row-status={transaction.status === 'cancelled' || transaction.status === 'refunded' ? transaction.status : undefined} onClick={openDetail}>{row.getAllCells().map((cell) => { const value = cell.column.id === 'categoryId' ? categoryById.get(transaction.categoryId ?? '') ?? '미분류' : cell.column.id === 'subcategoryId' ? categoryById.get(transaction.subcategoryId ?? '') ?? '없음' : cell.column.id === 'paymentMethodId' ? paymentMethodById.get(transaction.paymentMethodId ?? '') ?? '미지정' : null; return <td key={cell.id} data-table-field={cell.column.id} data-table-align={cell.column.id === 'amount' ? 'right' : ['transactionDate', 'status', 'transactionType', 'transactionGroup', 'costBehavior'].includes(cell.column.id) ? 'center' : undefined} data-flow={cell.column.id === 'transactionType' ? transaction.transactionType : undefined} className={`tds-table-cell ${['amount', 'transactionType'].includes(cell.column.id) ? 'font-semibold' : ''}`}>{cell.column.id === 'description' ? <button type="button" className="monthly-description-button" onClick={() => setSelected(transaction)}>{transaction.description}</button> : <><table.FlexRender cell={cell} />{value}</>}</td>; })}</tr>;
      })}</tbody></table>{pageCount > 1 && <nav className="monthly-table-pagination" aria-label="거래 목록 페이지 이동"><span>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, transactions.length)} / {transactions.length}건</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => current - 1)}><span className="sr-only">이전 페이지</span>이전</button><strong>{currentPage} / {pageCount}</strong><button type="button" disabled={currentPage === pageCount} onClick={() => setPage((current) => current + 1)}><span className="sr-only">다음 페이지</span>다음</button></div></nav>}{selected && <TransactionDetailDrawer key={selected.id} transaction={selected} candidates={duplicateCandidates[selected.id] ?? []} categories={categories} paymentMethods={paymentMethods} onClose={() => setSelected(null)} />}</div>;
}

export function MonthlyInputTab({
  initialTransactions,
  selectedMonth,
  categories,
  paymentMethods,
}: {
  initialTransactions: Transaction[];
  selectedMonth: string;
  categories: CategoryWithSubcategories[];
  paymentMethods: PaymentMethod[];
}) {
  const [query, setQuery] = useState('');
  // 유형 → 대분류 → 소분류는 서로 종속된 필터다: 유형을 좁히면 대분류 후보가, 대분류를 고르면
  // 소분류 후보가 그 안에서만 걸러진다(카테고리 자체가 income/expense 중 하나에만 속하므로).
  const [type, setType] = useState<'all' | 'income' | 'expense' | 'reference'>('all');
  // 2026-09(사용자 지시): "거래 조회 필터 모든 유형 우측에 거래 구분 필터 추가해서 모든 유형
  // 선택값에 따라서 선택할 수 있게 만들어. 모든 대분류와 모든 소분류 인터랙션 조건처럼" — 유형이
  // income이면 고정수입/부가 수입, expense면 소비성지출/저축성지출로 후보가 바뀌고, 그 밖(전체·
  // 참고 거래)에는 거래 구분 개념이 없어 '모든 거래 구분' 하나만 남는다(유형→대분류처럼 유형이
  // 바뀌면 group도 'all'로 리셋).
  const [group, setGroup] = useState<'all' | 'fixed' | 'additional' | 'savings' | 'consumption'>('all');
  const [category, setCategory] = useState('all');
  const [subcategory, setSubcategory] = useState('all');
  const [costBehavior, setCostBehavior] = useState<'all' | 'fixed' | 'variable'>('all');
  const [status, setStatus] = useState<'all' | Transaction['status']>('all');
  // 참고 거래는 categories 테이블에 자기 유형이 없어(income/expense만 있음) 대분류를 아예 안
  // 고르거나 두 유형 중 아무거나 골랐을 수 있다 — 필터에서도 '참고 거래' 선택 시 대분류 후보를
  // 전체로 보여준다.
  const availableCategories = useMemo(
    () => categories.filter((item) => type === 'all' || type === 'reference' || item.transactionType === type),
    [categories, type],
  );
  const selectedCategory = availableCategories.find((item) => item.id === category);
  const duplicateCandidates = useMemo(() => {
    return findRecurringDuplicateCandidates(initialTransactions);
  }, [initialTransactions]);
  const visibleTransactions = useMemo(() => initialTransactions.filter((transaction) => {
    const normalizedQuery = query.trim().toLowerCase();
    return (type === 'all' || transaction.transactionType === type)
      && (group === 'all' || (transaction.transactionType === 'income' ? transaction.incomeGroup === group : transaction.transactionType === 'expense' ? transaction.expenseGroup === group : false))
      && (category === 'all' || transaction.categoryId === category)
      && (subcategory === 'all' || transaction.subcategoryId === subcategory)
      && (costBehavior === 'all' || transaction.costBehavior === costBehavior)
      && (status === 'all' || transaction.status === status)
      && (!normalizedQuery || `${transaction.description} ${transaction.memo ?? ''}`.toLowerCase().includes(normalizedQuery));
  }), [initialTransactions, type, group, category, subcategory, costBehavior, status, query]);
  const visiblePlannedTransactions = visibleTransactions.filter((transaction) => transaction.status === 'planned');
  const visiblePostedTransactions = visibleTransactions.filter((transaction) => transaction.status !== 'planned');

  return (
    <div className="monthly-input-panel flex flex-col gap-4">
      <div className="monthly-cta monthly-quick-actions"><AddDrawer title="거래 추가" description="기록할 거래 유형을 선택하고 내용을 입력하세요." triggerLabel="거래 추가"><TransactionAddChooser categories={categories} paymentMethods={paymentMethods} /></AddDrawer></div>
      <section className="monthly-ledger-filters" aria-label="이번 달 거래 필터"><div className="monthly-ledger-filter-heading"><div><span className="monthly-kicker">거래 조회</span><strong>{selectedMonth.replace('-', '년 ')}월 거래</strong></div></div><div className="monthly-ledger-filter-grid">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="내용·메모 검색" aria-label="내용·메모 검색" />
        <select value={type} onChange={(event) => { const next = event.target.value as typeof type; setType(next); setGroup('all'); setCategory('all'); setSubcategory('all'); }} aria-label="유형"><option value="all">모든 유형</option><option value="income">수입</option><option value="expense">지출</option><option value="reference">참고 거래</option></select>
        <select value={group} onChange={(event) => setGroup(event.target.value as typeof group)} aria-label="거래 구분" disabled={type !== 'income' && type !== 'expense'}>
          <option value="all">모든 거래 구분</option>
          {type === 'income' && <><option value="fixed">고정 수입</option><option value="additional">부가 수입</option></>}
          {type === 'expense' && <><option value="consumption">소비성 지출</option><option value="savings">저축성 지출</option></>}
        </select>
        <select value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory('all'); }} aria-label="대분류"><option value="all">모든 대분류</option>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={subcategory} onChange={(event) => setSubcategory(event.target.value)} aria-label="소분류" disabled={!selectedCategory}><option value="all">모든 소분류</option>{selectedCategory?.subcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</select>
        <select value={costBehavior} onChange={(event) => setCostBehavior(event.target.value as typeof costBehavior)} aria-label="비용성격"><option value="all">모든 비용성격</option><option value="fixed">고정비</option><option value="variable">변동비</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="상태"><option value="all">모든 상태</option><option value="planned">예정</option><option value="posted">확정</option><option value="skipped">이번 달 제외</option><option value="cancelled">취소</option><option value="refunded">환불</option></select>
      </div></section>
      {visiblePlannedTransactions.length > 0 && <section className="monthly-transaction-section"><SectionHeader title="예정 거래" description="확인 후 상태 드롭다운에서 확정 또는 이번 달 제외를 선택하세요." action={<span className="text-sm font-semibold text-[var(--tds-grey-600)]">{visiblePlannedTransactions.length}건</span>} /><MonthlyTransactionTable transactions={visiblePlannedTransactions} categories={categories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} /></section>}
      <section className="monthly-transaction-section"><SectionHeader title="이번 달 거래" description="선택한 달의 수입·지출과 참고 거래를 관리해요." action={<span className="text-sm font-semibold text-[var(--tds-grey-600)]">{visiblePostedTransactions.length}건</span>} /><MonthlyTransactionTable transactions={visiblePostedTransactions} categories={categories} paymentMethods={paymentMethods} duplicateCandidates={duplicateCandidates} /></section>
    </div>
  );
}
