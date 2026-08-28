// PRD §9.1/§16.2: preserve separators while exposing only the last four digits.
export function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber) return '';

  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length <= 4) return accountNumber;

  let digitsSeen = 0;
  return Array.from(accountNumber, (character) => {
    if (!/\d/.test(character)) return character;
    digitsSeen += 1;
    return digitsSeen <= digits.length - 4 ? '*' : character;
  }).join('');
}
