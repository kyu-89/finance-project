import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/lib/nav-items';

describe('NAV_ITEMS', () => {
  it('exposes exactly the 5 first-level menus (대시보드/월간관리/분석/자산·금융/설정)', () => {
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      'dashboard',
      'monthly',
      'analysis',
      'finance',
      'settings',
    ]);
  });

  it('never grows a 6th top-level menu', () => {
    expect(NAV_ITEMS).toHaveLength(5);
  });
});
