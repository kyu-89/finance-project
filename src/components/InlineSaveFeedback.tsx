'use client';

import { useEffect, useState } from 'react';

// 2026-09(사용자 지시): 인라인 자동저장 컨트롤(성격/상태 select, [확정]/[이번달 제외] 버튼)의
// 저장 피드백 공통 규칙 — "저장됨"이 조건부로 나타났다 사라지며 표의 행 높이를 밀던 문제를
// 고쳤다. 항상 같은 자리(고정 높이)를 차지하고, "저장됨"은 2초 후 자동으로 지워지지만 자리
// 자체는 계속 예약돼 있어 주변 레이아웃이 흔들리지 않는다. InlineActionSelect와
// TransactionStatusEditor의 확정/이번달 제외 버튼이 모두 이 컴포넌트 하나만 쓴다 — 두 곳이
// 각자 다른 모양의 피드백을 그리지 않는다.
export function InlineSaveFeedback({ pending, ok, message }: { pending: boolean; ok: boolean | null; message?: string }) {
  // ok가 바뀐 시점을 렌더 중에 감지해 showSaved를 즉시 맞춘다(리액트가 권장하는 "렌더 중 상태
  // 조정" 패턴) — effect 안에서 무조건 setState를 호출하지 않기 위함이다. 실제 타이머(2초 뒤
  // 자동으로 숨기기)만 effect가 맡는다.
  const [prevOk, setPrevOk] = useState(ok);
  const [showSaved, setShowSaved] = useState(false);
  if (ok !== prevOk) {
    setPrevOk(ok);
    setShowSaved(ok === true);
  }

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [showSaved]);

  const text = pending ? '저장 중' : ok === false ? (message ?? '저장 실패') : showSaved ? '저장됨' : '';
  return (
    <span className={`transaction-status-feedback ${ok === false ? 'is-error' : ''}`.trim()} role={ok === false ? 'alert' : 'status'} aria-live="polite">
      {text || ' '}
    </span>
  );
}
