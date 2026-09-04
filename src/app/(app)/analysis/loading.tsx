export default function AnalysisLoading() {
  return <div className="tds-page animate-pulse" aria-label="분석 화면을 불러오는 중">
    <div className="h-9 w-80 max-w-full rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-[var(--tds-grey-200)]" />
    <div className="mt-6 h-12 rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-4 grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 rounded-2xl bg-[var(--tds-grey-200)]" />)}</div>
    <div className="mt-4 h-72 rounded-2xl bg-[var(--tds-grey-200)]" />
    <div className="mt-4 h-56 rounded-2xl bg-[var(--tds-grey-200)]" />
  </div>;
}
