'use client';
import { useState } from 'react';
const formatter = new Intl.NumberFormat('ko-KR');
export function CurrencyInput({ name, value, min = 0, ariaLabel }: { name: string; value: number; min?: number; ariaLabel: string }) {
  const [raw, setRaw] = useState(String(value)); const [focused, setFocused] = useState(false); const numericValue = Number(raw.replace(/[^\d-]/g, '')) || 0;
  return <><input type="hidden" name={name} value={numericValue} /><input type="text" inputMode="numeric" value={focused ? raw : formatter.format(numericValue)} aria-label={ariaLabel} placeholder="금액을 입력하세요" onFocus={() => { setFocused(true); setRaw(String(numericValue)); }} onBlur={() => { setFocused(false); setRaw(String(numericValue)); }} onChange={(event) => setRaw(event.target.value.replace(/[^\d-]/g, ''))} className="currency-input min-w-0 flex-1 px-2 text-right text-sm" data-min={min} /></>;
}
