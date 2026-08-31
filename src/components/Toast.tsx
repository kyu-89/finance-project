'use client';

import { useEffect, useState } from 'react';

export function Toast({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  const [hiddenMessage, setHiddenMessage] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setHiddenMessage(message), tone === 'error' ? 5600 : 4200);
    return () => window.clearTimeout(timer);
  }, [message, tone]);
  const visible = hiddenMessage !== message;
  if (!visible) return null;
  return <div className={`app-toast app-toast-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}><span>{message}</span><button type="button" onClick={() => setHiddenMessage(message)} aria-label="알림 닫기">×</button></div>;
}
