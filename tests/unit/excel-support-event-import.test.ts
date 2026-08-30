import { describe, expect, it } from 'vitest';
import { parseEventRows, parseSupportRows } from '@/lib/excel-support-event-import';

describe('excel support and event parsers', () => {
  it('parses government support rows', () => { const result = parseSupportRows([['지원금종류', '신청기간', '사용기간', '지급여부', '금액', '총 지원금', '접수처'], ['부모급여', '출생즉시', '-', 'ㅇ', 1000000, 18000000, '복지로']]); expect(result[0]).toMatchObject({ supportKind: '부모급여', amountPerOccurrence: 1000000, totalExpectedAmount: 18000000, issuer: '복지로' }); });
  it('parses two event blocks on one row', () => { const result = parseEventRows([['날짜', '내용', '금액', '', '날짜', '내용', '금액'], ['2026-01-01', '친구 결혼식 축의금', '100,000', '', '2026-02-01', '조모상 부조금', 50000]]); expect(result).toHaveLength(2); expect(result.map((item) => item.eventType)).toEqual(['wedding', 'condolence']); });
});
