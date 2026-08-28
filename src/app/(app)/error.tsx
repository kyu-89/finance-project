'use client';

import { useEffect } from 'react';

// Next.js 16 error boundary for the (app) route group. Server Actions in this app signal
// failure by throwing `Error` with a Korean message, but Next.js redacts those messages in
// production builds — without this boundary the user would see a crashed route with zero
// explanation and lose whatever they'd typed. This is intentionally minimal: a generic message,
// a note that the input may not have been saved, and a retry button wired to `reset`. A full
// per-field `useActionState` refactor (surfacing the real validation message inline) is
// deferred to a later sprint.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server Component errors arrive here with a redacted message plus a `digest` that
    // correlates to the real server-side log line — surface it for debugging.
    console.error(error);
  }, [error]);

  return (
    <main className="tds-page flex min-h-[60vh] items-center justify-center">
      <section className="tds-card flex w-full max-w-md flex-col items-center gap-4 p-6 text-center sm:p-8">
        <h2 className="text-xl font-bold text-[var(--tds-grey-900)]">문제가 생겼어요</h2>
        <p className="text-sm leading-6 text-[var(--tds-grey-700)]">
          입력한 내용이 저장되지 않았을 수 있어요. 잠시 후 다시 시도해 주세요.
        </p>
        <button type="button" onClick={() => reset()} className="tds-primary-button mt-2 w-full">
          다시 시도하기
        </button>
      </section>
    </main>
  );
}
