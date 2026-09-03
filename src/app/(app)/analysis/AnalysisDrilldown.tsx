'use client';

import { useState } from 'react';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import type { Transaction } from '@/lib/transactions';
import type { AnalysisRow, ExpenseCategoryRow } from '@/lib/analysis';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const TRANSACTION_CAP = 100;

// 2026-09(사용자 지시): 개별 거래 목록을 엑셀 같은 표로 통일한다 — 수입/지출/참고거래/카드
// 사용 4개 탭이 각자 다른 모양으로 개별 거래를 보여주던 것을, 어느 탭에서 열든 똑같은 표
// (날짜·내용·{extraColumn}·금액)로 맞춘다. extraColumn은 탭마다 의미 있는 값(지출/수입은
// 소분류, 참고거래는 분류, 카드 사용은 실제지출/참고거래 구분)을 넣도록 호출부가 정한다 —
// 표의 모양(디자인 시스템)은 하나로 통일하되 내용은 탭 맥락에 맞춘다. 항상 화면 가장 아래,
// 드릴다운을 펼쳤을 때만 나타난다.
export type TransactionExtraColumn = { label: string; valueFor: (t: Transaction) => string };

function TransactionRows({ transactions, extraColumn }: { transactions: Transaction[]; extraColumn?: TransactionExtraColumn }) {
  const sorted = [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const shown = sorted.slice(0, TRANSACTION_CAP);
  if (!sorted.length) return <p className="analysis-transaction-note">거래가 없어요.</p>;
  return <div className="analysis-transaction-table-wrap">
    <table className="analysis-transaction-table">
      <thead><tr><th>날짜</th><th>내용</th>{extraColumn && <th>{extraColumn.label}</th>}<th className="is-amount">금액</th></tr></thead>
      <tbody>{shown.map((t) => <tr key={t.id}>
        <td>{t.transactionDate}</td>
        <td className="is-desc">{t.description || '내용 없음'}</td>
        {extraColumn && <td>{extraColumn.valueFor(t)}</td>}
        <td className="is-amount"><Amount value={t.amount} type={t.transactionType === 'income' ? 'income' : t.transactionType === 'reference' ? 'neutral' : 'expense'} size="small" /></td>
      </tr>)}</tbody>
    </table>
    {sorted.length > TRANSACTION_CAP && <p className="analysis-transaction-note">최근 {TRANSACTION_CAP}건만 표시했어요 · 전체 {sorted.length}건</p>}
  </div>;
}

// §7/§9 — 2단계 드릴다운(항목 → 개별 거래). 수입(소분류)과 참고 거래(결제수단)가 이 컴포넌트를
// 공유한다 — 둘 다 "항목을 누르면 그 항목의 개별 거래가 펼쳐진다"는 같은 상호작용이다.
export function SimpleDrilldown({ rows, total, emptyText, transactionsFor, extraColumn }: { rows: AnalysisRow[]; total: number; emptyText: string; transactionsFor: (id: string) => Transaction[]; extraColumn?: TransactionExtraColumn }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <EmptyState title={emptyText} description="거래가 기록되면 항목별로 보여드려요." />;
  return <div className="analysis-drilldown">
    {rows.map((row) => { const isOpen = expanded === row.id; const share = total > 0 ? row.value / total * 100 : 0; return <div key={row.id} className="analysis-drilldown-group">
      <button type="button" className="analysis-drilldown-row" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : row.id)}>
        <span className="analysis-drilldown-label">{row.label}<i><em style={{ width: `${row.value / max * 100}%` }} /></i></span>
        <b>{money(row.value)} · {share.toFixed(1)}%</b>
      </button>
      {isOpen && <TransactionRows transactions={transactionsFor(row.id)} extraColumn={extraColumn} />}
    </div>; })}
  </div>;
}

// §8 — 3단계 드릴다운(대분류 → 소분류 → 개별 거래). 대분류를 누르면 소분류가, 소분류를 누르면
// 그 소분류의 개별 거래가 펼쳐진다. "주요 대분류·소분류 금액·비중은 기본 노출"(§8) — 목록 자체는
// 처음부터 다 보이고, 펼쳐야 하는 건 개별 거래뿐이다.
export function ExpenseDrilldown({ rows, total, transactionsFor, extraColumn }: { rows: ExpenseCategoryRow[]; total: number; transactionsFor: (categoryId: string, subcategoryId: string) => Transaction[]; extraColumn?: TransactionExtraColumn }) {
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
            {subOpen && <TransactionRows transactions={transactionsFor(row.id, sub.id)} extraColumn={extraColumn} />}
          </div>; })}
        </div>}
      </div>;
    })}
  </div>;
}
