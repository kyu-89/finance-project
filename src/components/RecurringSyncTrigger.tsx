'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { syncRecurringTransactionsAction } from '@/actions/recurring-sync-actions';

const SYNC_TTL_MS = 30 * 60 * 1000;

export function RecurringSyncTrigger({ fromDate, toDate, currentMonthStart }: { fromDate: string; toDate: string; currentMonthStart: string }) {
  const router = useRouter();
  const key = `recurring-sync:${fromDate}:${toDate}:${currentMonthStart}`;

  useEffect(() => {
    const now = Date.now();
    const lastSync = Number(window.sessionStorage.getItem(key) ?? 0);
    if (lastSync > 0 && now - lastSync < SYNC_TTL_MS) return;
    window.sessionStorage.setItem(key, String(now));
    void syncRecurringTransactionsAction({ fromDate, toDate, currentMonthStart })
      .then(() => router.refresh())
      .catch(() => {
        window.sessionStorage.removeItem(key);
      });
  }, [currentMonthStart, fromDate, key, router, toDate]);

  return null;
}
