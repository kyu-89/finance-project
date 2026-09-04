import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listLoans } from '@/lib/loans';
import { LoanManager } from './LoanManager';
import { listRecurringRules } from '@/lib/recurring-rules';
import { ProductRecurringInfo } from '@/components/ProductRecurringInfo';
import { ProductRecurringHistory } from '@/components/ProductRecurringHistory';
import { listLoanPayments } from '@/lib/loan-payments';
import { LoanPaymentManager } from './LoanPaymentManager';
import { FinanceBackLink } from '../FinanceBackLink';
import { PageHeader } from '@/components/PageHeader';
export default async function LoansPage() { const household = await ensureHouseholdForCurrentUser(); const [loans, rules, payments] = await Promise.all([listLoans(household.id), listRecurringRules(household.id), listLoanPayments(household.id)]); return <div className="tds-page flex flex-col gap-6"><PageHeader eyebrow="자산·금융" title="대출을 관리해요" description="대출 잔액과 상환 내역을 관리해요."><FinanceBackLink /></PageHeader><LoanManager loans={loans} today={new Date().toISOString().slice(0, 10)} /><LoanPaymentManager loans={loans} payments={payments} today={new Date().toISOString().slice(0, 10)} /><ProductRecurringInfo householdId={household.id} rules={rules} sourceType="loan" sourceIds={loans.map((item) => item.id)} /><ProductRecurringHistory householdId={household.id} rules={rules} sourceType="loan" sourceIds={loans.map((item) => item.id)} /></div>; }
