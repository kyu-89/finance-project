export default function MonthlyLoading() {
  return <div className="tds-page animate-pulse" aria-label="월간관리 화면을 불러오는 중">
    <div className="h-9 w-64 max-w-full rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-[var(--tds-grey-200)]" />
    <div className="mt-6 h-56 rounded-2xl bg-[var(--tds-grey-200)]" />
    <div className="mt-4 h-12 rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-4 h-[32rem] rounded-2xl bg-[var(--tds-grey-200)]" />
  </div>;
}
