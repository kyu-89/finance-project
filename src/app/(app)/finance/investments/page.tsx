import { todayInSeoul } from '@/lib/date';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listInvestmentTrades } from '@/lib/excel-extended-data';
import { InvestmentTradeManager } from './InvestmentTradeManager';
import { InvestmentAssetSummary } from './InvestmentAssetSummary';
export default async function InvestmentsPage() { const household = await ensureHouseholdForCurrentUser(); const trades = await listInvestmentTrades(household.id); return <><InvestmentTradeManager trades={trades} today={todayInSeoul()} /><div className="tds-page pt-0"><InvestmentAssetSummary trades={trades} /></div></>; }
