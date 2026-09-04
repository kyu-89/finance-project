'use client';

import { useState } from 'react';
import { Amount } from '@/components/Amount';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import type { AnnualReportRow } from '@/lib/annual-report';
import type { Transaction } from '@/lib/transactions';

const won = new Intl.NumberFormat('ko-KR');
const money = (value: number) => `${won.format(Math.round(value))}원`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const TRANSACTION_CAP = 100;

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
    <SectionHeader title={title} description={description} />
    {rows.length === 0 ? <div className="mt-4"><EmptyState title="표시할 데이터가 없어요" description="거래가 기록되면 엑셀과 같은 구조의 표를 보여드립니다." /></div> : <>
      <div className="analysis-heatmap-wrap mt-4">
        <table className="tds-data-table analysis-heatmap-table annual-report-table">
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

// AnalysisHeatmapTable(§12 이전 구현)이 쓰던 것과 같은 개별 거래 표 — "분석" 화면 재정리
// (사용자 지시: "가장 하단의 수입/지출/참고거래/카드사용/연간 리포트 영역은 제거되는거지")로
// 그 컴포넌트가 없어지면서 유일한 소비처가 됐다.
function HeatmapTransactionRows({ transactions }: { transactions: Transaction[] }) {
  const sorted = [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const shown = sorted.slice(0, TRANSACTION_CAP);
  if (!sorted.length) return <p className="analysis-transaction-note">거래가 없어요.</p>;
  return <div className="analysis-transaction-table-wrap" style={{ paddingLeft: 0 }}>
    <table className="tds-data-table analysis-transaction-table">
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
