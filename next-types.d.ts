// next/index.d.ts's `export * from './types'` can't resolve next/types.d.ts (doesn't exist in this next@16.3.3 build, only next/types.js does).
// Re-check this shim on the next `next` version bump.
declare module 'next/types.js' {
  export type { 
    ResolvingMetadata,
    ResolvingViewport,
  } from 'next';
}
