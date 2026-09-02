import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { PaymentMethodForm } from './PaymentMethodForm';
import { AddDrawer } from '@/components/Drawer';
import { Badge } from '@/components/Badge';
import { StatusSelect } from '@/components/StatusSelect';
import { setPaymentMethodActiveAction } from '@/actions/payment-method-actions';
import { SettingsBackLink } from '../SettingsBackLink';

export default async function PaymentMethodsSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const paymentMethods = await listPaymentMethods(household.id);

  return (
    <div className="tds-page flex max-w-3xl flex-col gap-6">
      <div><h1 className="tds-title mb-2">결제수단을 관리해요</h1><p className="text-sm text-[var(--tds-grey-700)]">자주 쓰는 카드와 계좌를 추가할 수 있어요.</p></div>
      <SettingsBackLink />

      <div className="flex justify-end"><AddDrawer title="결제수단 추가" description="카드·계좌·현금 등 자주 쓰는 결제수단을 등록하세요." triggerLabel="결제수단 추가"><PaymentMethodForm /></AddDrawer></div>

      <ul className="settings-resource-list list-surface flex flex-col divide-y divide-[var(--tds-grey-200)]">
        {paymentMethods.map((method) => (
          <li key={method.id} className="settings-resource-row flex min-h-16 items-center justify-between px-5">
            <div className={method.isActive ? '' : 'text-gray-400'}><div className="flex items-center gap-2"><span className={method.isActive ? 'font-semibold' : 'font-semibold line-through'}>{method.name}</span><Badge variant={method.isActive ? 'info' : 'neutral'}>{method.isActive ? '사용 중' : '사용 안 함'}</Badge></div><p className="mt-1 text-xs text-[var(--tds-grey-500)]">{[method.providerName, method.accountNumber ? `계좌 ${method.accountNumber}` : null, method.cardNumberLast4 ? `카드 •••• ${method.cardNumberLast4}` : null, method.expiresAt ? `만료 ${method.expiresAt.slice(0, 7)}` : null].filter(Boolean).join(' · ')}</p></div>
            <StatusSelect id={method.id} active={method.isActive} action={setPaymentMethodActiveAction} label={`${method.name} 활성 상태`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
