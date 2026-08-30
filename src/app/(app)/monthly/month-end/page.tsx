import Link from 'next/link';
import { listAccounts } from '@/lib/accounts';
import { listAssets } from '@/lib/assets';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listLoans } from '@/lib/loans';
import { listSavingsAccounts } from '@/lib/savings';
import { todayInSeoul } from '@/lib/date';
import { MonthEndCheck } from './MonthEndCheck';

export default async function MonthEndPage() {
  const household = await ensureHouseholdForCurrentUser();
  const today = todayInSeoul();
  const [accounts, savings, assets, loans] = await Promise.all([
    listAccounts(household.id), listSavingsAccounts(household.id), listAssets(household.id), listLoans(household.id),
  ]);

  return <div className="tds-page flex flex-col gap-6">
    <div><Link href="/monthly" className="text-sm font-semibold text-[var(--tds-blue-600)]">← 월간관리</Link>
      <h1 className="tds-title mt-3 mb-2">월말 자산을 점검해요</h1>
      <p className="text-sm text-[var(--tds-grey-700)]">통장·적금·기타자산의 현재 금액을 확인하고 이번 달 자산 스냅샷으로 남겨요.</p>
    </div>
    <MonthEndCheck accounts={accounts} savings={savings} assets={assets} loans={loans} today={today} />
  </div>;
}
