export type TermLength = 'short' | 'mid' | 'long';

export type DepositInput = {
  principal: number;
  annualRate: number; // 0.035 = 3.5%
  termMonths: number;
  taxRate: number; // 0.154 = 15.4%
};

export type DepositResult = {
  pretaxInterest: number;
  aftertaxInterest: number;
  maturityAmount: number;
};

// Whole months elapsed; a partial month does not count (Excel's DATEDIF "m" behaviour).
export function monthsBetween(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) {
    months -= 1;
  }
  return Math.max(0, months);
}

// PRD §6.7 preserves Excel's original thresholds verbatim, 36/37 gap included. The PRD flags
// them as unintuitive and says the UI may make them configurable later — do not "fix" them here.
export function classifyTermLength(termMonths: number): TermLength {
  if (termMonths > 37) return 'long';
  if (termMonths < 36) return 'short';
  return 'mid';
}

export function calculateDeposit(input: DepositInput): DepositResult {
  const pretaxInterest = Math.round(input.principal * input.annualRate * (input.termMonths / 12));
  const aftertaxInterest = Math.round(pretaxInterest * (1 - input.taxRate));
  return {
    pretaxInterest,
    aftertaxInterest,
    maturityAmount: input.principal + aftertaxInterest,
  };
}
