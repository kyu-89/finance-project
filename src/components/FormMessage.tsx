 'use client';

import type { ActionResult } from '@/lib/action-result';
import { Toast } from './Toast';

export function FormMessage({ result, successMessage = '저장했어요' }: { result: ActionResult; successMessage?: string }) {
  if (result.ok === null) {
    return null;
  }

  if (result.ok) {
    return <Toast message={result.message ?? successMessage} />;
  }

  return (
    <p
      role="alert"
      className="rounded-xl bg-[oklch(0.96_0.025_22)] px-4 py-3 text-sm text-[var(--tds-red-500)]"
    >
      {result.message}
    </p>
  );
}
