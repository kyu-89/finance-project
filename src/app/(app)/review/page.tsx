import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactionsNeedingReview } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { ReviewList } from './ReviewList';
import { PageHeader } from '@/components/PageHeader';

// 2026-09 Excel migration follow-up (docs/Excel 가계부 전체 마이그레이션 작업.md): a dedicated
// screen so a household member (not the person who ran the migration) can review, fix, confirm,
// or delete every transaction the migration flagged needs_review=true — without touching the
// codebase or the DB directly. Once nothing is left to review, this page's entry point in
// SettingsNav hides itself (see settings/page.tsx) — the route itself stays reachable and just
// shows a "모두 검토 완료" state, rather than 404ing a bookmarked link.
export default async function ReviewPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [transactions, categories, paymentMethods] = await Promise.all([
    listTransactionsNeedingReview(household.id),
    listCategoriesWithSubcategories(household.id),
    listPaymentMethods(household.id),
  ]);

  return (
    <div className="tds-page">
      <PageHeader eyebrow="데이터 관리" title="검토 필요 거래" description="자동으로 분류하지 못한 거래를 확인하고 확정하거나 수정해요." />
      <ReviewList transactions={transactions} categories={categories} paymentMethods={paymentMethods} />
    </div>
  );
}
