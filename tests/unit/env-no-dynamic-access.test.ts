import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('env.ts static analyzability', () => {
  it('does not read NEXT_PUBLIC_* vars via dynamic bracket access on process.env', () => {
    // Next.js's bundler (Turbopack/webpack) can only inline NEXT_PUBLIC_* vars into the
    // browser bundle when the source contains a literal `process.env.NEXT_PUBLIC_X`
    // expression. `process.env[name]` with a variable name cannot be statically replaced,
    // so it silently resolves to `undefined` in the browser (there is no real process.env
    // there). This test guards against ever reintroducing that pattern.
    const source = readFileSync(path.resolve(__dirname, '../../src/lib/env.ts'), 'utf-8');

    expect(source).not.toContain('process.env[');
  });

  it('reads each NEXT_PUBLIC_* var via a literal, statically analyzable expression', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/lib/env.ts'), 'utf-8');

    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL');
    expect(source).toContain('process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });
});
