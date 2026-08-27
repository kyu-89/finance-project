import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/lib/nav-items';

describe('NAV_ITEMS', () => {
  it('exposes exactly the 4 first-level menus mandated by the PRD', () => {
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      'dashboard',
      'monthly',
      'finance',
      'settings',
    ]);
  });

  it('never grows a 5th top-level menu', () => {
    expect(NAV_ITEMS).toHaveLength(4);
  });
});
