import { SignOutButton } from '@/components/SignOutButton';
import { PageHeader } from '@/components/PageHeader';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { countTransactionsNeedingReview } from '@/lib/transactions';
import { SettingsNav } from './SettingsNav';

export default async function SettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const reviewCount = await countTransactionsNeedingReview(household.id);
  return <div className="tds-page flex flex-col gap-6">
    <PageHeader eyebrow="설정" title="가계부 설정" description="가족, 분류, 예산, 반복 거래와 데이터를 관리해요." />
    <SettingsNav reviewCount={reviewCount} />
    <div><SignOutButton /></div>
  </div>;
}
