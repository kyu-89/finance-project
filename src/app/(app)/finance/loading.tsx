export default function FinanceLoading() {
  return <div className="tds-page animate-pulse" aria-label="자산과 금융 화면을 불러오는 중">
    <div className="h-9 w-72 max-w-full rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-6 grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-32 rounded-2xl bg-[var(--tds-grey-200)]" />)}</div>
    <div className="mt-4 h-20 rounded-2xl bg-[var(--tds-grey-200)]" />
    <div className="mt-4 grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-36 rounded-2xl bg-[var(--tds-grey-200)]" />)}</div>
  </div>;
}
