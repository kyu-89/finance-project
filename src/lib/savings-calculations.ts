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

// 월복리 (PRD §6.8): FV minus 납입원금, using an **annuity DUE** — deposits at the START of each
// month — i.e. Excel's FV(rate, nper, pmt, pv, type=1). The trailing × (1+i) is what makes it a
// due rather than an ordinary annuity.
//
// This must match 단리's deposit timing or the two methods are not comparable. 단리's
// n(n+1)/2 factor sums 12+11+…+1 months of holding, meaning the first deposit earns a full n
// months — a start-of-month schedule, which is how Korean 적금 actually works. Using an ordinary
// annuity (type=0) here would give the first deposit only n−1 months, understating 월복리 by one
// period: at 12 months / 3% that produced 83,191원 against 단리's 97,500원, i.e. compounding
// appearing to LOSE to simple interest on the same schedule. With the correct due convention it
// is 98,399원, and 월복리 > 단리 at every term, as it must be.
//
// i = annualRate/12 is 0 whenever annualRate is 0, which would divide by zero — a 0% rate
// must yield 0 interest, so that case is handled explicitly rather than falling through.
function compoundPretaxInterest(monthlyAmount: number, termMonths: number, annualRate: number): number {
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) {
    return 0;
  }
  const futureValue =
    monthlyAmount * ((Math.pow(1 + monthlyRate, termMonths) - 1) / monthlyRate) * (1 + monthlyRate);
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
