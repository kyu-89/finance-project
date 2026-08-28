export type LoanRepaymentMethod = 'equal_payment' | 'equal_principal' | 'bullet';

export type AmortizationInput = {
  principal: number;
  annualRate: number;
  termMonths: number;
  graceMonths: number;
  method: LoanRepaymentMethod;
  firstPaymentDate: string;
};

export type AmortizationRow = {
  installment: number;
  paymentDate: string;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  cumulativePayment: number;
  remainingBalance: number;
};

export function paymentMonthsInclusive(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return Math.max(1, (toYear - fromYear) * 12 + toMonth - fromMonth + 1);
}

function addMonthsClamped(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function assertInput(input: AmortizationInput): void {
  if (!Number.isSafeInteger(input.principal) || input.principal <= 0) throw new Error('대출원금은 0보다 큰 원 단위 정수여야 합니다.');
  if (!Number.isFinite(input.annualRate) || input.annualRate < 0) throw new Error('연이자율을 확인해 주세요.');
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1) throw new Error('대출기간은 1개월 이상이어야 합니다.');
  if (!Number.isInteger(input.graceMonths) || input.graceMonths < 0 || input.graceMonths >= input.termMonths) throw new Error('거치기간은 전체 기간보다 짧아야 합니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstPaymentDate)) throw new Error('첫 상환일을 확인해 주세요.');
}

export function buildAmortizationSchedule(input: AmortizationInput): AmortizationRow[] {
  assertInput(input);
  const monthlyRate = input.annualRate / 12;
  const amortizingMonths = input.termMonths - input.graceMonths;
  const equalPayment = monthlyRate === 0
    ? Math.round(input.principal / amortizingMonths)
    : Math.round(input.principal * monthlyRate * Math.pow(1 + monthlyRate, amortizingMonths)
      / (Math.pow(1 + monthlyRate, amortizingMonths) - 1));
  const equalPrincipal = Math.round(input.principal / amortizingMonths);
  let balance = input.principal;
  let cumulativePayment = 0;
  const rows: AmortizationRow[] = [];

  for (let index = 0; index < input.termMonths; index += 1) {
    const inGrace = index < input.graceMonths;
    const final = index === input.termMonths - 1;
    const interestPayment = Math.round(balance * monthlyRate);
    let principalPayment = 0;
    if (!inGrace) {
      if (final || input.method === 'bullet' && final) principalPayment = balance;
      else if (input.method === 'equal_principal') principalPayment = Math.min(balance, equalPrincipal);
      else if (input.method === 'equal_payment') principalPayment = Math.min(balance, Math.max(0, equalPayment - interestPayment));
    }
    balance -= principalPayment;
    const totalPayment = principalPayment + interestPayment;
    cumulativePayment += totalPayment;
    rows.push({
      installment: index + 1, paymentDate: addMonthsClamped(input.firstPaymentDate, index),
      principalPayment, interestPayment, totalPayment, cumulativePayment, remainingBalance: balance,
    });
  }
  return rows;
}

export function findCurrentSnapshot(schedule: AmortizationRow[], isoDate: string): AmortizationRow | null {
  let current: AmortizationRow | null = null;
  for (const row of schedule) {
    if (row.paymentDate > isoDate) break;
    current = row;
  }
  return current;
}

export function summarizeLoan(schedule: AmortizationRow[]): { totalInterest: number; totalPayment: number } {
  return schedule.reduce((summary, row) => ({
    totalInterest: summary.totalInterest + row.interestPayment,
    totalPayment: summary.totalPayment + row.totalPayment,
  }), { totalInterest: 0, totalPayment: 0 });
}
