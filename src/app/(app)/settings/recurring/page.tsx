import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listRecurringPauses, listRecurringRules } from '@/lib/recurring-rules';
import { RecurringRuleForm } from './RecurringRuleForm';
import { RecurringRuleStatusButton } from './RecurringRuleStatusButton';
import { RecurringRuleAmountForm } from './RecurringRuleAmountForm';
import { RecurringPauseForm } from './RecurringPauseForm';
import { RecurringRuleScheduleForm } from './RecurringRuleScheduleForm';
import { AddDrawer } from '@/components/Drawer';
import { SettingsBackLink } from '../SettingsBackLink';

const STATUS_LABEL = { active: '사용 중', paused: '일시중지', ended: '종료' } as const;
const FREQUENCY_LABEL = { monthly: '개월', weekly: '주', yearly: '년', custom: '일' } as const;

export default async function RecurringSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const [rules, pauses, categories, paymentMethods] = await Promise.all([
    listRecurringRules(household.id), listRecurringPauses(household.id), listCategoriesWithSubcategories(household.id), listPaymentMethods(household.id),
  ]);

  return <div className="tds-page flex max-w-3xl flex-col gap-6">
    <SettingsBackLink />
    <div><h1 className="tds-title mb-2">반복항목을 관리해요</h1>
      <p className="text-sm text-[var(--tds-grey-700)]">월세, 급여, 구독처럼 반복되는 거래를 예정 내역으로 만들어요.</p></div>
    <div className="flex justify-end"><AddDrawer title="반복 항목 추가" description="월세·급여·구독처럼 반복되는 거래를 한 번만 등록하세요." triggerLabel="반복 항목 추가"><RecurringRuleForm categories={categories} paymentMethods={paymentMethods} /></AddDrawer></div>
    <ul className="recurring-rule-list">
      {rules.length === 0 && <li className="px-5 py-8 text-center text-sm text-[var(--tds-grey-500)]">아직 반복항목이 없어요.</li>}
      {rules.map((rule) => <li key={rule.id} className="recurring-rule-card">
        <div><div className="flex items-center gap-2"><span className="font-semibold">{rule.description}</span>
          <span className="tds-chip">{STATUS_LABEL[rule.status]}</span></div>
              <p className="mt-1 text-sm text-[var(--tds-grey-700)]">
            {rule.defaultAmount.toLocaleString('ko-KR')}원 · {rule.intervalCount}{FREQUENCY_LABEL[rule.frequency]}마다 · {rule.startDate}부터
          </p><AddDrawer title={`${rule.description} 수정`} description="금액과 반복 주기를 바꾸면 이후 예정 거래에 반영됩니다." triggerLabel="정보 수정"><div className="recurring-rule-edit-body"><RecurringRuleAmountForm id={rule.id} amount={rule.defaultAmount} ended={rule.status === 'ended'} />
          <RecurringRuleScheduleForm id={rule.id} frequency={rule.frequency} intervalCount={rule.intervalCount} day={rule.dayOfMonth ?? 1} ended={rule.status === 'ended'} />
          <RecurringPauseForm id={rule.id} ended={rule.status === 'ended'} pauses={pauses.filter((pause) => pause.recurringRuleId === rule.id)} /></div></AddDrawer></div>
        <RecurringRuleStatusButton id={rule.id} status={rule.status} />
      </li>)}
    </ul>
  </div>;
}
