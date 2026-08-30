export default function AppLoading() {
  return <div className="tds-page animate-pulse" aria-label="화면 불러오는 중">
    <div className="h-4 w-24 rounded-full bg-[var(--tds-grey-200)]" />
    <div className="mt-3 h-9 w-64 max-w-full rounded-xl bg-[var(--tds-grey-200)]" />
    <div className="mt-8 grid gap-4 lg:grid-cols-2"><div className="h-64 rounded-[24px] bg-white" /><div className="h-64 rounded-[24px] bg-white" /></div>
    <div className="mt-5 grid gap-4 md:grid-cols-3"><div className="h-40 rounded-[20px] bg-white" /><div className="h-40 rounded-[20px] bg-white" /><div className="h-40 rounded-[20px] bg-white" /></div>
  </div>;
}
