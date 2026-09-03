import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { listPaymentMethods } from '@/lib/payment-methods';
import { listRecurringPauses, listRecurringRules } from '@/lib/recurring-rules';
import { RecurringRuleForm } from './RecurringRuleForm';
import { RecurringRuleStatusSelect } from './RecurringRuleStatusSelect';
import { RecurringRuleAmountForm } from './RecurringRuleAmountForm';
import { RecurringPauseForm } from './RecurringPauseForm';
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
    <ul className="settings-resource-list recurring-rule-list">
      {rules.length === 0 && <li className="px-5 py-8 text-center text-sm text-[var(--tds-grey-500)]">아직 반복항목이 없어요.</li>}
      {rules.map((rule) => {
        // 대출·적금 상품이 자동 생성한 반복항목(source_id 있음)은 여기서 분류·일정을 자유롭게
        // 고칠 수 없게 한다 — amountFor()가 subcategory_id로 원금/이자를 구분하고, 반복 일정이
        // 상품의 실제 상환 일정과 일치해야 하기 때문(사용자 확인). 대신 이번 달 금액 예외
        // 변경·일시중지·상태 변경은 그대로 둔다.
        const isProductLinked = rule.sourceId !== null;
        return <li key={rule.id} className="recurring-rule-card">
          <div className="recurring-rule-card-body">
            <div className="recurring-rule-card-heading">
              <strong>{rule.description}</strong>
              <span className="tds-chip">{STATUS_LABEL[rule.status]}</span>
            </div>
            <p className="recurring-rule-card-meta">
              {rule.defaultAmount.toLocaleString('ko-KR')}원 · {rule.intervalCount}{FREQUENCY_LABEL[rule.frequency]}마다 · {rule.startDate}부터
            </p>
            {isProductLinked
              ? <p className="recurring-rule-card-note">대출·적금 상품에서 자동으로 관리돼요 — 금액·분류·일정은 해당 상품 화면에서 수정하세요.</p>
              : <AddDrawer title="반복 항목 수정" description="금액·분류·주기를 바꾸면 이후 예정 거래에 반영됩니다." triggerLabel="정보 수정"><RecurringRuleForm categories={categories} paymentMethods={paymentMethods} rule={rule} /></AddDrawer>}
            <div className="recurring-rule-card-quick-actions">
              <RecurringRuleAmountForm id={rule.id} amount={rule.defaultAmount} ended={rule.status === 'ended'} />
              <RecurringPauseForm id={rule.id} ended={rule.status === 'ended'} pauses={pauses.filter((pause) => pause.recurringRuleId === rule.id)} />
            </div>
          </div>
          <RecurringRuleStatusSelect id={rule.id} status={rule.status} />
        </li>;
      })}
    </ul>
  </div>;
}
