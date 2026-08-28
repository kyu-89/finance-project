import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

export default function SettingsPage() {
  return (
    <div className="tds-page max-w-3xl">
      <h1 className="tds-title mb-2">설정을 관리해요</h1>
      <p className="mb-6 text-sm text-[var(--tds-grey-700)]">분류와 결제수단을 우리 집에 맞게 바꿀 수 있어요.</p>
      <nav className="list-surface flex flex-col divide-y divide-[var(--tds-grey-200)]">
        <Link href="/settings/categories" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>카테고리 관리</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
        <Link href="/settings/payment-methods" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>결제수단 관리</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
        <Link href="/settings/recurring" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>반복항목 관리</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
        <Link href="/settings/budgets" className="flex min-h-16 items-center justify-between px-5 text-[15px] font-semibold">
          <span>연간 예산 관리</span><span className="text-[var(--tds-grey-400)]">›</span>
        </Link>
      </nav>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
