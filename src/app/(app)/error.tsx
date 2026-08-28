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
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">문제가 발생했습니다.</h2>
      <p className="text-sm text-gray-500">
        입력한 내용이 저장되지 않았을 수 있습니다. 다시 시도해주세요.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-black px-4 py-2 text-sm text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
