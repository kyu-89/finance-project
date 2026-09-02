import { describe, expect, it } from 'vitest';
import { parseInsuranceRows, parseLoanRows } from '@/lib/excel-loan-insurance-import';

describe('excel loan and insurance parsers', () => {
  it('parses loan basics and repayment history', () => { const result = parseLoanRows([['기관명', '대출명', '대출금액', '연이자율', '상환방법', '대출일', '상환만기일'], ['국민은행', '주택담보대출', 220000000, 0.036, '원리금', '2025-10-30', '2065-10-30'], ['', '상환기간(개월)', '남은기간(개월)', '', '', '', ''], [], ['회차', '상환일', '납입원금', '대출이자', '월상환금', '누적상환금', '대출잔금', '비고'], [1, '2025-11-30', 21699, 650958, 672657, 672657, 219978301, '']]); expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ institutionName: '국민은행', originalAmount: 220000000, annualRate: 0.036, firstPaymentDate: '2025-11-30', payments: [{ installment: 1, principalPayment: 21699, interestPayment: 650958, totalPayment: 672657, remainingBalance: 219978301 }] }); });
  it('parses insurance premiums and dates', () => { const result = parseInsuranceRows([['보험사', '종류', '보험명', '보장내역', '납부방법', '가입일', '납입만기', '보험만기', '월보험료'], ['삼성화재', '보장성', '건강보험', '암', '자동이체', '2025-01-01', '2030-01-01', '2090-01-01', '38,764']]); expect(result[0]).toMatchObject({ monthlyPremium: 38764, coverageMaturityDate: '2090-01-01' }); });
});
