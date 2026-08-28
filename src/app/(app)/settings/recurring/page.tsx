import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listRecurringRules } from '@/lib/recurring-rules';
import { RecurringRuleForm } from './RecurringRuleForm';
import { RecurringRuleStatusButton } from './RecurringRuleStatusButton';
import { RecurringRuleAmountForm } from './RecurringRuleAmountForm';

const STATUS_LABEL = { active: '사용 중', paused: '일시중지', ended: '종료' } as const;
const FREQUENCY_LABEL = { monthly: '개월', weekly: '주', yearly: '년', custom: '일' } as const;

export default async function RecurringSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [rules, categories, paymentMethods] = await Promise.all([
    listRecurringRules(household.id), listCategoriesWithSubcategories(household.id), listPaymentMethods(household.id),
  ]);

  return <div className="tds-page flex max-w-3xl flex-col gap-6">
    <div><h1 className="tds-title mb-2">반복항목을 관리해요</h1>
      <p className="text-sm text-[var(--tds-grey-700)]">월세, 급여, 구독처럼 반복되는 거래를 예정 내역으로 만들어요.</p></div>
    <RecurringRuleForm categories={categories} paymentMethods={paymentMethods} />
    <ul className="list-surface flex flex-col divide-y divide-[var(--tds-grey-200)]">
      {rules.length === 0 && <li className="px-5 py-8 text-center text-sm text-[var(--tds-grey-500)]">아직 반복항목이 없어요.</li>}
      {rules.map((rule) => <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div><div className="flex items-center gap-2"><span className="font-semibold">{rule.description}</span>
          <span className="tds-chip">{STATUS_LABEL[rule.status]}</span></div>
          <p className="mt-1 text-sm text-[var(--tds-grey-700)]">
            {rule.defaultAmount.toLocaleString('ko-KR')}원 · {rule.intervalCount}{FREQUENCY_LABEL[rule.frequency]}마다 · {rule.startDate}부터
          </p><RecurringRuleAmountForm id={rule.id} amount={rule.defaultAmount} ended={rule.status === 'ended'} /></div>
        <RecurringRuleStatusButton id={rule.id} status={rule.status} />
      </li>)}
    </ul>
  </div>;
}
