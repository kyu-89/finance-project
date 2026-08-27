import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('env', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(async () => {
      const mod = await import('@/lib/env?t=' + Date.now());
      return mod;
    }).rejects.toThrow('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  });
});
