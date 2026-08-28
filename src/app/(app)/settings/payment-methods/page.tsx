import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { PaymentMethodForm } from './PaymentMethodForm';
import { DeactivatePaymentMethodButton } from './DeactivatePaymentMethodButton';

export default async function PaymentMethodsSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const paymentMethods = await listPaymentMethods(household.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">결제수단 관리</h1>

      <PaymentMethodForm />

      <ul className="flex flex-col gap-2">
        {paymentMethods.map((method) => (
          <li key={method.id} className="flex items-center justify-between rounded border p-3">
            <span className={method.isActive ? '' : 'text-gray-400 line-through'}>{method.name}</span>
            {method.isActive && <DeactivatePaymentMethodButton id={method.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
