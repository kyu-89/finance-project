import { InlineActionSelect } from '@/components/InlineActionSelect';
import type { ActionResult } from '@/lib/action-result';

const ACTIVE_OPTIONS = [
  { value: 'true', label: '활성' },
  { value: 'false', label: '비활성' },
] as const;

export function StatusSelect({ id, active, action, label = '상태', className = '' }: {
  id: string;
  active: boolean;
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  label?: string;
  className?: string;
}) {
  return <InlineActionSelect
    action={action}
    id={id}
    label={label}
    name="isActive"
    value={active ? 'true' : 'false'}
    options={ACTIVE_OPTIONS}
    hiddenFields={{ id }}
    className={`status-select ${className}`}
  />;
}
