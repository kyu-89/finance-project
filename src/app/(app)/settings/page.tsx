import { SignOutButton } from '@/components/SignOutButton';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { countTransactionsNeedingReview } from '@/lib/transactions';
import { SettingsNav } from './SettingsNav';

export default async function SettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const reviewCount = await countTransactionsNeedingReview(household.id);
  return <div className="tds-page">
    <h1 className="tds-title mb-2">설정</h1>
    <p className="mb-6 text-sm text-[var(--tds-grey-700)]">가족, 분류, 예산, 반복 항목과 데이터를 관리합니다.</p>
    <SettingsNav reviewCount={reviewCount} />
    <div className="mt-8"><SignOutButton /></div>
  </div>;
}
