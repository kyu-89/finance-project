'use client';

import { useId, useState } from 'react';

const won = new Intl.NumberFormat('ko-KR');

// 금액을 입력하는 모든 필드가 따라야 할 디자인 시스템 규칙: 입력하는 동안 천단위 콤마가
// 실시간으로 찍힌다(저장된 값을 보여주는 <Amount>와 짝을 이루는 입력용 컴포넌트).
// `type="number"` 네이티브 입력은 콤마를 표시할 수 없어서(포맷팅된 텍스트를 숫자로 못 읽음),
// 화면에는 콤마 포맷 텍스트를, 실제 제출값은 숨은 input(name={name})의 순수 숫자 문자열로
// 분리한다 — 이 컴포넌트를 쓰는 폼/액션 쪽은 지금처럼 `Number(formData.get(name))`만 읽으면
// 되고 바뀔 게 없다. required는 보이는 입력 쪽에 걸어야 브라우저 유효성 검사 말풍선이 뜬다
// (숨은 input은 포커스가 안 가서 required가 있어도 아무 표시가 안 된다).
export function AmountInput({
  name,
  defaultValue,
  required = false,
  placeholder = '금액을 입력하세요',
  className = '',
  id,
  'aria-label': ariaLabel,
}: {
  name: string;
  defaultValue?: number | string | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const toDigits = (value: number | string | null | undefined) =>
    value === null || value === undefined || value === '' ? '' : String(value).replace(/[^\d]/g, '');
  const [digits, setDigits] = useState(toDigits(defaultValue));
  const displayValue = digits ? won.format(Number(digits)) : '';

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        id={inputId}
        value={displayValue}
        onChange={(event) => setDigits(toDigits(event.target.value))}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        className={className}
      />
      <input type="hidden" name={name} value={digits} />
    </>
  );
}
