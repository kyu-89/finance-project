import { SectionHeader } from '@/components/SectionHeader';
import type { InvestmentTrade } from '@/lib/excel-extended-data';
import { summarizeInvestmentByAsset } from '@/lib/investment-calculations';

const won = new Intl.NumberFormat('ko-KR');

export function InvestmentAssetSummary({ trades }: { trades: InvestmentTrade[] }) {
  const rows = summarizeInvestmentByAsset(trades);

  return (
    <section className="tds-card tds-section-card mt-5">
      <SectionHeader title="종목별 투자 흐름" description="매수·매도 정산액 기준의 누적 현금흐름입니다. 평가손익과는 구분됩니다." />
      {rows.length === 0 ? <p className="text-sm text-[var(--tds-grey-500)]">종목별 거래가 없습니다.</p> : <div className="overflow-x-auto"><table className="tds-data-table min-w-[640px]"><thead><tr><th>종목</th><th data-table-align="right">거래</th><th data-table-align="right">매수</th><th data-table-align="right">매도</th><th data-table-align="right">수수료</th><th data-table-align="right">순현금흐름</th></tr></thead><tbody>{rows.map((row) => <tr key={row.assetName}><td>{row.assetName}</td><td data-table-align="right">{row.tradeCount}건</td><td data-table-align="right">{won.format(Math.round(row.buyAmount))}원</td><td data-table-align="right">{won.format(Math.round(row.sellAmount))}원</td><td data-table-align="right">{won.format(Math.round(row.fees))}원</td><td data-table-align="right" className={row.netCashFlow >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>{row.netCashFlow >= 0 ? '+' : ''}{won.format(Math.round(row.netCashFlow))}원</td></tr>)}</tbody></table></div>}
    </section>
  );
}
