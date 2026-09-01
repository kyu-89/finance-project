import Link from 'next/link';

const items = [
  ['가족 구성원', '가구 구성원과 활성 상태', '/settings#members'],
  ['재무 목표', '목표 금액과 진행 상황', '/settings#goals'],
  ['재무 일정', '기념일·점검 일정', '/settings#tasks'],
  ['카테고리 관리', '수입·지출 분류', '/settings/categories'],
  ['결제수단 관리', '카드·계좌·현금', '/settings/payment-methods'],
  ['거래 내역 가져오기', '엑셀·CSV·백업 데이터', '/settings/data'],
] as const;

export function SettingsNav() {
  return <nav aria-label="설정 메뉴" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {items.map(([title, description, href]) => <Link key={title} href={href}
      className="tds-card group flex min-h-20 items-center justify-between gap-4 p-4 transition hover:border-[var(--tds-blue-300)] hover:bg-[var(--tds-blue-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tds-blue-500)]">
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{title}</span><span className="mt-1 block truncate text-xs text-[var(--tds-grey-600)]">{description}</span></span>
      <span aria-hidden="true" className="shrink-0 text-lg text-[var(--tds-grey-400)] transition group-hover:translate-x-0.5">→</span>
    </Link>)}
  </nav>;
}
