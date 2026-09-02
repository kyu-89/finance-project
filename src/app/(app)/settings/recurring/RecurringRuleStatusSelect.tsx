import { updateRecurringRuleStatusAction } from '@/actions/recurring-rule-actions';
import { InlineActionSelect } from '@/components/InlineActionSelect';
import type { RecurringRuleStatus } from '@/lib/recurring-rules';

const LABEL: Record<RecurringRuleStatus, string> = {
  active: '사용 중',
  paused: '일시 중지',
  ended: '종료',
};

const OPTIONS = (Object.entries(LABEL) as Array<[RecurringRuleStatus, string]>)
  .map(([value, label]) => ({ value, label }));

export function RecurringRuleStatusSelect({ id, status }: { id: string; status: RecurringRuleStatus }) {
  return <InlineActionSelect
    action={updateRecurringRuleStatusAction}
    id={id}
    label="반복 항목 상태"
    name="status"
    value={status}
    options={OPTIONS}
    hiddenFields={{ id }}
    disabled={status === 'ended'}
  />;
}
