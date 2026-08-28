import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">설정</h1>
      <p className="text-sm text-gray-500">가족 구성원/카테고리/목표·일정/데이터/보안을 관리합니다.</p>
      <nav className="flex flex-col gap-2">
        <Link href="/settings/categories" className="underline">
          카테고리 관리
        </Link>
        <Link href="/settings/payment-methods" className="underline">
          결제수단 관리
        </Link>
      </nav>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
