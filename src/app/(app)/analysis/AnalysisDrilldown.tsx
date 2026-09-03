'use client';

import { useState } from 'react';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import type { Transaction } from '@/lib/transactions';
import type { AnalysisRow, ExpenseCategoryRow } from '@/lib/analysis';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const TRANSACTION_CAP = 100;

function TransactionRows({ transactions }: { transactions: Transaction[] }) {
  const sorted = [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const shown = sorted.slice(0, TRANSACTION_CAP);
  return <div className="analysis-transaction-list">
    {shown.map((t) => <div key={t.id} className="analysis-transaction-row"><span>{t.transactionDate}</span><span className="analysis-transaction-desc">{t.description}</span><Amount value={t.amount} type={t.transactionType === 'income' ? 'income' : t.transactionType === 'reference' ? 'neutral' : 'expense'} size="small" /></div>)}
    {sorted.length > TRANSACTION_CAP && <p className="analysis-transaction-note">최근 {TRANSACTION_CAP}건만 표시했어요 · 전체 {sorted.length}건</p>}
    {!sorted.length && <p className="analysis-transaction-note">거래가 없어요.</p>}
  </div>;
}

// §7/§9 — 2단계 드릴다운(항목 → 개별 거래). 수입(소분류)과 참고 거래(결제수단)가 이 컴포넌트를
// 공유한다 — 둘 다 "항목을 누르면 그 항목의 개별 거래가 펼쳐진다"는 같은 상호작용이다.
export function SimpleDrilldown({ rows, total, emptyText, transactionsFor }: { rows: AnalysisRow[]; total: number; emptyText: string; transactionsFor: (id: string) => Transaction[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <EmptyState title={emptyText} description="거래가 기록되면 항목별로 보여드려요." />;
  return <div className="analysis-drilldown">
    {rows.map((row) => { const isOpen = expanded === row.id; const share = total > 0 ? row.value / total * 100 : 0; return <div key={row.id} className="analysis-drilldown-group">
      <button type="button" className="analysis-drilldown-row" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : row.id)}>
        <span className="analysis-drilldown-label">{row.label}<i><em style={{ width: `${row.value / max * 100}%` }} /></i></span>
        <b>{money(row.value)} · {share.toFixed(1)}%</b>
      </button>
      {isOpen && <TransactionRows transactions={transactionsFor(row.id)} />}
    </div>; })}
  </div>;
}

// §8 — 3단계 드릴다운(대분류 → 소분류 → 개별 거래). 대분류를 누르면 소분류가, 소분류를 누르면
// 그 소분류의 개별 거래가 펼쳐진다. "주요 대분류·소분류 금액·비중은 기본 노출"(§8) — 목록 자체는
// 처음부터 다 보이고, 펼쳐야 하는 건 개별 거래뿐이다.
export function ExpenseDrilldown({ rows, total, transactionsFor }: { rows: ExpenseCategoryRow[]; total: number; transactionsFor: (categoryId: string, subcategoryId: string) => Transaction[] }) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openSubcategory, setOpenSubcategory] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <EmptyState title="지출이 없어요" description="거래가 기록되면 대분류별로 보여드려요." />;
  return <div className="analysis-drilldown">
    {rows.map((row) => {
      const isOpen = openCategory === row.id; const share = total > 0 ? row.value / total * 100 : 0;
      return <div key={row.id} className="analysis-drilldown-group">
        <button type="button" className="analysis-drilldown-row" aria-expanded={isOpen} onClick={() => { setOpenCategory(isOpen ? null : row.id); setOpenSubcategory(null); }}>
          <span className="analysis-drilldown-label">{row.label}<i><em style={{ width: `${row.value / max * 100}%` }} /></i></span>
          <b>{money(row.value)} · {share.toFixed(1)}%</b>
        </button>
        {isOpen && <div className="analysis-drilldown-sub">
          {row.subcategories.map((sub) => { const subOpen = openSubcategory === sub.id; const subShare = row.value > 0 ? sub.value / row.value * 100 : 0; return <div key={sub.id}>
            <button type="button" className="analysis-drilldown-row is-sub" aria-expanded={subOpen} onClick={() => setOpenSubcategory(subOpen ? null : sub.id)}>
              <span>{sub.label}</span><b>{money(sub.value)} · {subShare.toFixed(1)}%</b>
            </button>
            {subOpen && <TransactionRows transactions={transactionsFor(row.id, sub.id)} />}
          </div>; })}
        </div>}
      </div>;
    })}
  </div>;
}
