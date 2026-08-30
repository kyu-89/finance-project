import type { ActionResult } from '@/lib/action-result';

export function FormMessage({ result, successMessage = '저장했어요' }: { result: ActionResult; successMessage?: string }) {
  if (result.ok === null) {
    return null;
  }

  if (result.ok) {
    return (
      <p
        role="status"
        className="rounded-xl bg-[var(--tds-grey-900)] px-4 py-3 text-sm text-white shadow-[0_8px_24px_oklch(0.155_0.06_261/0.16)]"
      >
        {result.message ?? successMessage}
      </p>
    );
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
