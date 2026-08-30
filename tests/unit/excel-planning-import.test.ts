import { describe, expect, it } from 'vitest';
import { parsePlanningRows } from '@/lib/excel-planning-import';

describe('excel planning parser', () => {
  it('extracts goals and tasks from the main sheet columns', () => { const result = parsePlanningRows([['', '', '', '2026년 재무목표', '', '', '', '', '', '2026년 재무일정'], ['', '', '', '자동차 구입', '', '', '', '', '', '6월 자동차세 납부'], ['', '', '', '월 목표저축액', '', '', '', '', '', '11월 보험 갱신']], 2026); expect(result.goals.map((item) => item.name)).toContain('자동차 구입'); expect(result.tasks[0]).toMatchObject({ title: '6월 자동차세 납부', taskDate: '2026-06-30' }); });
});
