import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    hookTimeout: 20000,
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // 'server-only' throws when resolved via its default export condition, which is what
      // vitest's plain Node module resolution picks (Next.js's bundler instead sets the
      // "react-server" condition, resolving its no-op empty.js). Point tests at that same
      // no-op so modules using `import 'server-only'` (categories.ts, household.ts, etc.)
      // are importable from unit tests without pulling in a React Server Component runtime.
      'server-only': path.resolve(import.meta.dirname, './node_modules/server-only/empty.js'),
    },
  },
});
