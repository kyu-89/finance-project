export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly' | 'custom';

export type RecurrenceSchedule = {
  startDate: string;
  endDate?: string | null;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfMonth?: number | null;
};

function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('날짜는 YYYY-MM-DD 형식이어야 합니다.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (formatDate(date) !== value) throw new Error('유효한 날짜가 아닙니다.');
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthlyDate(start: Date, monthOffset: number, requestedDay: number): Date {
  const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
  const day = Math.min(requestedDay, daysInMonth(monthStart.getUTCFullYear(), monthStart.getUTCMonth()));
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day));
}

export function listOccurrenceDates(
  schedule: RecurrenceSchedule,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (!Number.isInteger(schedule.intervalCount) || schedule.intervalCount < 1) {
    throw new Error('반복 간격은 1 이상의 정수여야 합니다.');
  }

  const start = parseDate(schedule.startDate);
  const end = schedule.endDate ? parseDate(schedule.endDate) : null;
  const from = parseDate(rangeStart);
  const to = parseDate(rangeEnd);
  if (from > to) throw new Error('조회 시작일은 종료일보다 늦을 수 없습니다.');
  if (end && end < start) throw new Error('반복 종료일은 시작일보다 빠를 수 없습니다.');

  const results: string[] = [];
  const requestedDay = schedule.dayOfMonth ?? start.getUTCDate();
  if (requestedDay < 1 || requestedDay > 31) throw new Error('월 납부일은 1~31이어야 합니다.');

  for (let index = 0; index < 10000; index += 1) {
    let occurrence: Date;
    if (schedule.frequency === 'monthly') {
      occurrence = monthlyDate(start, index * schedule.intervalCount, requestedDay);
    } else if (schedule.frequency === 'yearly') {
      occurrence = monthlyDate(start, index * schedule.intervalCount * 12, requestedDay);
    } else {
      const dayStep = schedule.frequency === 'weekly' ? schedule.intervalCount * 7 : schedule.intervalCount;
      occurrence = new Date(start.getTime() + index * dayStep * 86_400_000);
    }

    if (occurrence > to || (end && occurrence > end)) break;
    if (occurrence >= start && occurrence >= from) results.push(formatDate(occurrence));
  }

  return results;
}
