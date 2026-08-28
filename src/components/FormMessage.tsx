import type { ActionResult } from '@/lib/action-result';

export function FormMessage({ result }: { result: ActionResult }) {
  if (result.ok === null) {
    return null;
  }

  if (result.ok) {
    return (
      <p
        role="status"
        className="rounded border border-green-500 bg-green-50 px-3 py-2 text-sm text-green-700"
      >
        저장되었습니다
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="rounded border border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {result.message}
    </p>
  );
}
