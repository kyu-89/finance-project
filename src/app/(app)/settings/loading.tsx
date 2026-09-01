export default function SettingsLoading() {
  return <div className="tds-page animate-pulse" aria-label="설정 화면을 불러오는 중">
    <div className="h-9 w-56 max-w-full rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-[var(--tds-grey-200)]" />
    <div className="mt-6 h-64 rounded-2xl bg-[var(--tds-grey-200)]" />
    <div className="mt-4 h-48 rounded-2xl bg-[var(--tds-grey-200)]" />
  </div>;
}
