'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import type { AnnualReportRow } from '@/lib/annual-report';
import type { Transaction } from '@/lib/transactions';
import { HeatmapTransactionRows } from './AnalysisHeatmapTable';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

// §12 — "연간 리포트" 섹션(사용자 지시: "연간 리포트라는 별도 섹션이 좋을 것 같아"). 원본 엑셀의
// 4개 [연간_…] 시트를 annual-report.ts가 만든 AnnualReportRow[]로 그대로 렌더링한다.
// item 행만 기존 히트맵과 같은 클릭→개별거래 드릴다운을 갖는다 — subtotal/total/ratio/checksum은
// 합쳐진 계산값이라 "그 항목의 거래"라는 게 없다(대신 굵게+옅은 배경으로 시각적으로만 구분한다).
export function AnnualReportTable({ title, description, months, rows, tone, showGroupColumn = false, transactionsFor }: {
  title: string; description: string; months: string[]; rows: AnnualReportRow[]; tone: 'income' | 'expense';
  showGroupColumn?: boolean;
  transactionsFor: (row: AnnualReportRow, month: string) => Transaction[];
}) {
  const [openCell, setOpenCell] = useState<{ rowId: string; rowLabel: string; month: string } | null>(null);
  const colorVar = tone === 'income' ? '--chart-income' : '--chart-expense';

  return <section className="tds-card p-5">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="mt-1 text-sm text-[var(--tds-grey-700)]">{description}</p>
    {rows.length === 0 ? <div className="mt-4"><EmptyState title="표시할 데이터가 없어요" description="거래가 기록되면 엑셀과 같은 구조의 표를 보여드립니다." /></div> : <>
      <div className="analysis-heatmap-wrap mt-4">
        <table className="analysis-heatmap-table annual-report-table">
          <thead><tr>
            {showGroupColumn && <th className="is-label">대분류</th>}
            <th className={showGroupColumn ? 'is-label annual-report-label-secondary' : 'is-label'}>항목</th>
            {months.map((m) => <th key={m}>{Number(m.slice(5, 7))}월</th>)}
            <th className="is-total">계</th><th className="is-total">평균</th>
          </tr></thead>
          <tbody>{rows.map((row) => {
            const rowKindClass = `annual-report-row-${row.kind}`;
            const isRatio = row.kind === 'ratio' || row.kind === 'checksum';
            const rowMax = Math.max(1, ...row.monthly);
            return <tr key={row.id} className={rowKindClass}>
              {showGroupColumn && <th className="is-label" scope="row">{row.groupLabel ?? ''}</th>}
              <th className={showGroupColumn ? 'is-label annual-report-label-secondary' : 'is-label'} scope="row">{row.label}</th>
              {row.monthly.map((value, index) => {
                const month = months[index];
                if (row.kind !== 'item') {
                  return <td key={month}><span className="annual-report-static-cell">{isRatio ? percent(value) : (value !== 0 ? money(value) : '-')}</span></td>;
                }
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
              <td className="is-total">{isRatio ? '-' : money(row.total)}</td>
              <td className="is-total">{isRatio ? percent(row.total) : money(row.total / (months.length || 1))}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {openCell && <div className="mt-4">
        <p className="text-sm font-semibold text-[var(--tds-grey-800)]">{openCell.rowLabel} · {Number(openCell.month.slice(5, 7))}월 개별 거래</p>
        <HeatmapTransactionRows transactions={transactionsFor(rows.find((r) => r.id === openCell.rowId)!, openCell.month)} />
      </div>}
    </>}
  </section>;
}
