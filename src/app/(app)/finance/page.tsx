import Link from 'next/link';
import { Amount } from '@/components/Amount';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { todayInSeoul } from '@/lib/date';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { calculateNetWorthChange } from '@/lib/net-worth';
import { computeCurrentNetWorth, listRecentSnapshots } from '@/lib/snapshots';
import { SnapshotButton } from './SnapshotButton';

const won = new Intl.NumberFormat('ko-KR');

export default async function FinancePage() {
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const [summary, snapshots] = await Promise.all([
    computeCurrentNetWorth(household.id, today),
    listRecentSnapshots(household.id),
  ]);
  const thisMonth = `${today.slice(0, 7)}-01`;
  const previous = snapshots.find((snapshot) => snapshot.snapshotMonth < thisMonth);
  const change = previous ? calculateNetWorthChange(summary.netWorth, previous.netWorth) : null;

  return (
    <div className="tds-page">
      <PageHeader
        eyebrow="자산·금융"
        title="자산·금융을 관리해요"
        description="계좌·상품·기타자산과 대출을 포함한 현재 우리 집 재산을 관리해요."
        action={<SnapshotButton />}
      />

      <section className="mt-6 tds-summary-grid" aria-label="자산 요약">
        <MetricCard label="총자산" value={summary.totalAssets} />
        <MetricCard label="총부채" value={summary.totalDebt} type="expense" />
        <MetricCard
          label="순자산"
          value={summary.netWorth}
          type="income"
          detail={change
            ? `전월 대비 ${change.amount >= 0 ? '+' : ''}${won.format(change.amount)}원${change.rate === null ? '' : ` (${(change.rate * 100).toFixed(1)}%)`}`
            : '이번 달 자산을 기록하면 다음 달 변화와 비교할 수 있어요.'}
        />
      </section>

      <section className="tds-card mt-4 grid grid-cols-2 gap-4 p-5 md:grid-cols-5" aria-label="자산 구성">
        <Mini label="계좌" value={summary.cashAssets} />
        <Mini label="예금" value={summary.depositAssets} />
        <Mini label="적금" value={summary.savingsAssets} />
        <Mini label="투자" value={summary.investmentAssets} />
        <Mini label="비금융자산" value={summary.nonFinancialAssets} />
      </section>

      <nav className="mt-6 grid gap-4 md:grid-cols-2" aria-label="자산·금융 관리 메뉴">
        <Menu href="/finance/accounts" title="계좌·증권" text="입출금·증권 계좌의 현재 잔액을 관리해요." />
        <Menu href="/finance/savings" title="예금·적금" text="가입 현황과 이자·만기 정보를 관리해요." />
        <Menu href="/finance/loans" title="대출" text="대출 잔액과 월별 원금·이자 상환을 관리해요." />
        <Menu href="/finance/insurances" title="보험" text="보장 내용과 보험료·갱신 일정을 관리해요." />
        <Menu href="/finance/assets" title="기타자산" text="부동산·자동차·금속 등 자산을 관리해요." />
        <Menu href="/finance/investments" title="투자 거래" text="매수·매도 내역과 투자금 흐름을 관리해요." />
      </nav>
    </div>
  );
}

function MetricCard({ label, value, type = 'neutral', detail }: {
  label: string;
  value: number;
  type?: 'income' | 'expense' | 'neutral';
  detail?: string;
}) {
  return <StatCard label={label} value={<Amount value={value} type={type} size="large" />} meta={detail} />;
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-[var(--tds-grey-500)]">{label}</p><strong className="tabular-nums">{won.format(value)}원</strong></div>;
}

function Menu({ href, title, text }: { href: string; title: string; text: string }) {
  return <Link href={href} className="tds-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-[var(--tds-grey-700)]">{text}</p></Link>;
}
