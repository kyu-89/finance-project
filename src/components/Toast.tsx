'use client';

import { useEffect, useState } from 'react';

export function Toast({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setVisible(false), 4200); return () => window.clearTimeout(timer); }, []);
  if (!visible) return null;
  return <div className={`app-toast app-toast-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite"><span>{message}</span><button type="button" onClick={() => setVisible(false)} aria-label="알림 닫기">×</button></div>;
}
