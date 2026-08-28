export type SavingsMethod = 'simple' | 'monthly_compound';

export type SavingsInput = {
  monthlyAmount: number;
  annualRate: number; // 0.03 = 3.0%
  termMonths: number;
  taxRate: number; // 0.154 = 15.4%
  method: SavingsMethod;
};

export type SavingsResult = {
  maturityPrincipal: number;
  pretaxInterest: number;
  aftertaxInterest: number;
  maturityAmount: number;
};

// 단리 (PRD §6.8): 월적립액 × [n(n+1)/2] × (연이율/12). Interest is not rounded per-deposit —
// only the aggregate pretax figure is rounded, matching the deposit module's convention of
// rounding at the boundary where a 원 amount is produced (see deposit-calculations.ts).
function simplePretaxInterest(monthlyAmount: number, termMonths: number, annualRate: number): number {
  const monthlyRate = annualRate / 12;
  return monthlyAmount * (termMonths * (termMonths + 1) / 2) * monthlyRate;
}

// 월복리 (PRD §6.8): FV of an ordinary annuity, PMT × ((1+i)^n − 1) / i, minus 납입원금.
// i = annualRate/12 is 0 whenever annualRate is 0, which would divide by zero — a 0% rate
// must yield 0 interest, so that case is handled explicitly rather than falling through.
function compoundPretaxInterest(monthlyAmount: number, termMonths: number, annualRate: number): number {
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) {
    return 0;
  }
  const futureValue = monthlyAmount * ((Math.pow(1 + monthlyRate, termMonths) - 1) / monthlyRate);
  return futureValue - monthlyAmount * termMonths;
}

export function calculateSavings(input: SavingsInput): SavingsResult {
  const maturityPrincipal = input.monthlyAmount * input.termMonths;

  const rawPretaxInterest =
    input.method === 'simple'
      ? simplePretaxInterest(input.monthlyAmount, input.termMonths, input.annualRate)
      : compoundPretaxInterest(input.monthlyAmount, input.termMonths, input.annualRate);

  // Round only at the boundary where a 원 amount is produced (see deposit-calculations.ts);
  // 세후이자 is then derived from the already-rounded pretax figure, not the raw float.
  const pretaxInterest = Math.round(rawPretaxInterest);
  const aftertaxInterest = Math.round(pretaxInterest * (1 - input.taxRate));

  return {
    maturityPrincipal,
    pretaxInterest,
    aftertaxInterest,
    maturityAmount: maturityPrincipal + aftertaxInterest,
  };
}
