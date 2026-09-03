import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactionsNeedingReview } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { ReviewList } from './ReviewList';

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
      <h1 className="tds-title mb-2">검토 필요 거래</h1>
      <p className="mb-6 text-sm text-[var(--tds-grey-700)]">
        Excel에서 가져온 거래 중 날짜·카테고리·결제수단을 확실히 판단하지 못해 자동으로 표시해 둔 항목입니다. 내용을 확인해서 수정하거나, 문제없으면 확정해 주세요. 모두 처리하면 이 화면은 설정 메뉴에서 사라집니다.
      </p>
      <ReviewList transactions={transactions} categories={categories} paymentMethods={paymentMethods} />
    </div>
  );
}
