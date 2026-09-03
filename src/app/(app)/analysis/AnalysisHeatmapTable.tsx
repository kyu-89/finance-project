'use client';

import { useState } from 'react';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import type { MatrixRow } from '@/lib/analysis';
import type { Transaction } from '@/lib/transactions';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const TRANSACTION_CAP = 100;

// §12 — 원본 엑셀(연간_항목별수입/연간_항목별지출/연간_카드별지출)과 같은 "항목 × 12개월" 표를
// 그대로 보여주되, 셀 배경을 그 행 안에서의 상대적 크기로 옅게 칠해서(히트맵) 숫자를 하나하나
// 읽지 않아도 "이 항목은 몇 월에 유독 컸다/줄었다" 패턴이 바로 보이게 한다. 숫자는 전부 그대로
// 남아있어 엑셀 표를 대체하는 기능은 잃지 않는다. 연간 스코프에서만 쓰고, 셀을 누르면 그 항목·
// 그 달의 개별 거래를 표 바로 아래에 펼친다(기존 드릴다운과 같은 클릭→상세 규칙).
export function AnalysisHeatmapTable({ title, description, months, rows, monthCount, tone, transactionsFor }: {
  title: string; description: string; months: string[]; rows: MatrixRow[]; monthCount: number; tone: 'income' | 'expense';
  transactionsFor: (rowId: string, month: string) => Transaction[];
}) {
  const [openCell, setOpenCell] = useState<{ rowId: string; rowLabel: string; month: string } | null>(null);
  const colorVar = tone === 'income' ? '--chart-income' : '--chart-expense';

  return <section className="tds-card p-5">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="mt-1 text-sm text-[var(--tds-grey-700)]">{description}</p>
    {rows.length === 0 ? <div className="mt-4"><EmptyState title="표시할 데이터가 없어요" description="거래가 기록되면 항목별 12개월 표를 보여드립니다." /></div> : <>
      <div className="analysis-heatmap-wrap mt-4">
        <table className="analysis-heatmap-table">
          <thead><tr><th className="is-label">항목</th>{months.map((m) => <th key={m}>{Number(m.slice(5, 7))}월</th>)}<th className="is-total">계</th><th className="is-total">평균</th></tr></thead>
          <tbody>{rows.map((row) => {
            const rowMax = Math.max(1, ...row.monthly);
            return <tr key={row.id}>
              <th className="is-label" scope="row">{row.label}</th>
              {row.monthly.map((value, index) => {
                const month = months[index];
                const intensity = value > 0 ? Math.min(0.7, (value / rowMax) * 0.7) : 0;
                const isOpen = openCell?.rowId === row.id && openCell.month === month;
                return <td key={month}>
                  <button
                    type="button"
                    className={`analysis-heatmap-cell ${isOpen ? 'is-open' : ''}`}
                    style={value > 0 ? { background: `color-mix(in oklab, var(${colorVar}) ${(intensity * 100).toFixed(0)}%, white)` } : undefined}
                    onClick={() => setOpenCell(isOpen ? null : { rowId: row.id, rowLabel: row.label, month })}
                    disabled={value === 0}
                  >
                    {value > 0 ? money(value) : '-'}
                  </button>
                </td>;
              })}
              <td className="is-total">{money(row.total)}</td>
              <td className="is-total">{money(row.total / monthCount)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {openCell && <div className="mt-4">
        <p className="text-sm font-semibold text-[var(--tds-grey-800)]">{openCell.rowLabel} · {Number(openCell.month.slice(5, 7))}월 개별 거래</p>
        <HeatmapTransactionRows transactions={transactionsFor(openCell.rowId, openCell.month)} />
      </div>}
    </>}
  </section>;
}

function HeatmapTransactionRows({ transactions }: { transactions: Transaction[] }) {
  const sorted = [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const shown = sorted.slice(0, TRANSACTION_CAP);
  if (!sorted.length) return <p className="analysis-transaction-note">거래가 없어요.</p>;
  return <div className="analysis-transaction-table-wrap" style={{ paddingLeft: 0 }}>
    <table className="analysis-transaction-table">
      <thead><tr><th>날짜</th><th>내용</th><th className="is-amount">금액</th></tr></thead>
      <tbody>{shown.map((t) => <tr key={t.id}>
        <td>{t.transactionDate}</td>
        <td className="is-desc">{t.description || '내용 없음'}</td>
        <td className="is-amount"><Amount value={t.amount} type={t.transactionType === 'income' ? 'income' : t.transactionType === 'reference' ? 'neutral' : 'expense'} size="small" /></td>
      </tr>)}</tbody>
    </table>
    {sorted.length > TRANSACTION_CAP && <p className="analysis-transaction-note">최근 {TRANSACTION_CAP}건만 표시했어요 · 전체 {sorted.length}건</p>}
  </div>;
}
