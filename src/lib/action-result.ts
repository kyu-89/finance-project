// Next.js redacts thrown Server Action error messages in production builds, so an action
// that signals failure by throwing gives the user a blank error page and no explanation.
// Returning a result instead keeps the message on the wire and lets useActionState render it.
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }
  | { ok: null };

export const INITIAL_ACTION_STATE: ActionResult = { ok: null };

export function ok(message?: string): ActionResult {
  return message ? { ok: true, message } : { ok: true };
}

export function fail(message: string): ActionResult {
  return { ok: false, message };
}
