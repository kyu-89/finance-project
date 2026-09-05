'use client';

import { useState } from 'react';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import type { TransactionSummary } from '@/lib/transactions';
import type { AnalysisRow } from '@/lib/analysis';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const TRANSACTION_CAP = 100;

// 2026-09(사용자 지시): 개별 거래 목록을 엑셀 같은 표로 통일한다 — 수입/지출/참고거래/카드
// 사용이 각자 다른 모양으로 개별 거래를 보여주던 것을, 어느 아코디언에서 열든 똑같은 표
// (날짜·내용·{extraColumn}·금액)로 맞춘다. 2026-09 재정리(사용자 지시: "컬럼이나 디자인
// 시스템이 일관되지 않아")로 extraColumn도 라벨·대체문구까지 통일했다 — 수입/지출/참고거래는
// 전부 "소분류"(subcategoryId 조회, 못 찾으면 "기타"), 카드 사용만 결제수단이 소분류 개념이
// 없어서 "카테고리"(대분류)를 대신 보여준다. 항상 화면 가장 아래, 드릴다운을 펼쳤을 때만 나타난다.
export type TransactionExtraColumn = { label: string; valueFor: (t: TransactionSummary) => string };

function TransactionRows({ transactions, extraColumn }: { transactions: TransactionSummary[]; extraColumn?: TransactionExtraColumn }) {
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

// §7/§8/§9/§10 — 2단계 드릴다운(항목 → 개별 거래). 수입(소분류)·지출(대분류)·참고 거래
// (결제수단)·카드 사용(카드)이 전부 이 컴포넌트를 공유한다 — "항목을 누르면 그 항목의 개별
// 거래가 펼쳐진다"는 같은 상호작용이다(사용자 지시: "다른 것과 동일하게 1단계 구조로 통일").
// 예전엔 지출만 대분류→소분류→개별거래 3단계였는데, 소분류 정보는 사라지지 않고 개별 거래
// 표의 extraColumn(소분류 컬럼)으로 옮겨갔다.
export function SimpleDrilldown({ rows, total, emptyText, transactionsFor, extraColumn }: { rows: AnalysisRow[]; total: number; emptyText: string; transactionsFor: (id: string) => TransactionSummary[]; extraColumn?: TransactionExtraColumn }) {
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
