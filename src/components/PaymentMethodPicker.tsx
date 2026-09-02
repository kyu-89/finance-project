'use client';

import type { PaymentMethod } from '@/lib/payment-methods';

/**
 * 결제수단 선택 칩. `CategoryPicker`의 자매 컴포넌트로, 세 곳(빠른 입력 / 월간 추가 드로어 /
 * 거래 상세 드로어)이 각자 인라인 칩·네이티브 select로 재구현했던 것을 한 곳으로 모은 것이다.
 *
 * 내부 `useState`를 두지 않은 controlled 컴포넌트다 — 세 호출부 모두 이미 자기 폼 상태를 들고
 * (그리고 hidden input으로 제출)하기 때문에, 내부 상태를 또 만들면 두 상태가 어긋난다.
 */
export function PaymentMethodPicker({
  paymentMethods,
  selectedId = null,
  onSelect,
  allowClear = false,
}: {
  paymentMethods: PaymentMethod[];
  selectedId?: string | null;
  // null은 "미지정으로 되돌리기"(allowClear일 때만 발생). 생성 폼은 allowClear를 끄므로 항상
  // PaymentMethod가 들어온다.
  onSelect: (paymentMethod: PaymentMethod | null) => void;
  // 기존 네이티브 select의 `<option value="">미지정</option>`에 대응. 결제수단이 필수인 생성
  // 폼에서는 끈다.
  allowClear?: boolean;
}) {
  // 비활성 결제수단은 새로 고를 수 없어야 하지만, 이미 그 수단으로 저장된 거래를 수정하는
  // 화면에서는 현재 값이 보여야 한다 — 안 그러면 칩 줄은 "아무것도 선택 안 됨"처럼 보이는데
  // 폼은 그 id를 그대로 제출하는 상태가 된다.
  const options = paymentMethods.filter((method) => method.isActive || method.id === selectedId);

  return (
    <div className="flex flex-wrap gap-2">
      {allowClear && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          data-selected={!selectedId}
          className="tds-chip px-4"
        >
          미지정
        </button>
      )}
      {options.map((method) => (
        <button
          key={method.id}
          type="button"
          onClick={() => onSelect(method)}
          data-selected={selectedId === method.id}
          className="tds-chip px-4"
        >
          {method.name}
        </button>
      ))}
    </div>
  );
}
