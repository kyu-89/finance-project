import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listPaymentMethods } from '@/lib/payment-methods';
import { createPaymentMethodAction, deactivatePaymentMethodAction } from '@/actions/payment-method-actions';

export default async function PaymentMethodsSettingsPage() {
  const household = await ensureHouseholdForCurrentUser();
  const paymentMethods = await listPaymentMethods(household.id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">결제수단 관리</h1>

      <form action={createPaymentMethodAction} className="flex flex-wrap items-end gap-2 rounded border p-4">
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input name="name" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          종류
          <select name="methodType" className="rounded border px-2 py-1">
            <option value="credit_card">신용카드</option>
            <option value="check_card">체크카드</option>
            <option value="account_transfer">계좌이체</option>
            <option value="cash">현금</option>
            <option value="other">기타</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">
          추가
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {paymentMethods.map((method) => (
          <li key={method.id} className="flex items-center justify-between rounded border p-3">
            <span className={method.isActive ? '' : 'text-gray-400 line-through'}>{method.name}</span>
            {method.isActive && (
              <form action={deactivatePaymentMethodAction}>
                <input type="hidden" name="id" value={method.id} />
                <button type="submit" className="text-sm text-red-600">
                  비활성화
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
