import { describe, expect, it } from 'vitest';
import { fail, INITIAL_ACTION_STATE, ok } from '@/lib/action-result';

describe('ActionResult', () => {
  it('ok() produces a success result', () => {
    expect(ok()).toEqual({ ok: true });
  });

  it('fail() carries the user-facing message', () => {
    expect(fail('금액을 입력해주세요.')).toEqual({ ok: false, message: '금액을 입력해주세요.' });
  });

  it('the initial state is neither success nor failure so nothing renders on first paint', () => {
    expect(INITIAL_ACTION_STATE).toEqual({ ok: null });
  });
});
