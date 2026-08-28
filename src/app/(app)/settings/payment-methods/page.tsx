import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { PaymentMethodForm } from './PaymentMethodForm';
import { DeactivatePaymentMethodButton } from './DeactivatePaymentMethodButton';

export default async function PaymentMethodsSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const paymentMethods = await listPaymentMethods(household.id);

  return (
    <div className="tds-page flex max-w-3xl flex-col gap-6">
      <div><h1 className="tds-title mb-2">결제수단을 관리해요</h1><p className="text-sm text-[var(--tds-grey-700)]">자주 쓰는 카드와 계좌를 추가할 수 있어요.</p></div>

      <PaymentMethodForm />

      <ul className="list-surface flex flex-col divide-y divide-[var(--tds-grey-200)]">
        {paymentMethods.map((method) => (
          <li key={method.id} className="flex min-h-16 items-center justify-between px-5">
            <span className={method.isActive ? '' : 'text-gray-400 line-through'}>{method.name}</span>
            {method.isActive && <DeactivatePaymentMethodButton id={method.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
