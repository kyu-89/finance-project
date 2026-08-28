import Link from 'next/link';

export default function FinancePage() {
  return (
    <div className="tds-page">
      <h1 className="tds-title mb-2">자산과 금융을 모아서 봐요</h1>
      <p className="mt-2 text-sm text-[var(--tds-grey-700)]">우리 집의 자산과 금융상품을 한곳에서 관리해요.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/finance/accounts" className="tds-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
          <span className="text-sm font-semibold text-[var(--tds-blue-500)]">사용 가능</span>
          <h2 className="mt-2 text-xl font-bold">계좌·카드</h2>
          <p className="mt-2 text-sm text-[var(--tds-grey-700)]">현재 잔액, 연회비, 혜택과 해지 일정을 기록해요.</p>
        </Link>
        <Link href="/finance/savings" className="tds-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg"><span className="text-sm font-semibold text-[var(--tds-blue-500)]">사용 가능</span><h2 className="mt-2 text-xl font-bold">예금·적금</h2><p className="mt-2 text-sm text-[var(--tds-grey-700)]">금리와 기간으로 이자와 만기 수령액을 자동 계산해요.</p></Link>
        <div className="tds-card p-6 opacity-70"><span className="text-sm font-semibold text-[var(--tds-grey-500)]">순차 개발 중</span><h2 className="mt-2 text-xl font-bold">대출·보험·기타자산</h2><p className="mt-2 text-sm text-[var(--tds-grey-700)]">상품 상환표와 순자산 스냅샷을 연결할 예정이에요.</p></div>
      </div>
    </div>
  );
}
