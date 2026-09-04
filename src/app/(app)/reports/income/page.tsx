import Link from 'next/link';
import { ensureHouseholdForCurrentUser } from '@/lib/household';
import { listTransactions } from '@/lib/transactions';
import { listCategoriesWithSubcategories } from '@/lib/categories';
import { todayInSeoul } from '@/lib/date';

const won = new Intl.NumberFormat('ko-KR');
export default async function IncomeReportPage() {
  const household = await ensureHouseholdForCurrentUser();
  const year = Number(todayInSeoul().slice(0, 4));
  const [transactions, categories] = await Promise.all([listTransactions({ householdId: household.id, fromDate: `${year}-01-01`, toDate: `${year}-12-31` }), listCategoriesWithSubcategories(household.id)]);
  const income = transactions.filter((t) => t.status === 'posted' && t.transactionType === 'income');
  const nameById = new Map(categories.flatMap((c) => [{ id: c.id, name: c.name }, ...c.subcategories.map((s) => ({ id: s.id, name: s.name }))]).map((item) => [item.id, item.name]));
  const rows = new Map<string, { name: string; total: number; fixed: number; additional: number; months: number[] }>();
  for (const transaction of income) { const key = transaction.subcategoryId ?? transaction.categoryId ?? 'unassigned'; const row = rows.get(key) ?? { name: nameById.get(key) ?? '미분류', total: 0, fixed: 0, additional: 0, months: Array(12).fill(0) }; row.total += transaction.amount; if (transaction.incomeGroup === 'additional') row.additional += transaction.amount; else row.fixed += transaction.amount; row.months[Number(transaction.transactionDate.slice(5, 7)) - 1] += transaction.amount; rows.set(key, row); }
  const ordered = [...rows.values()].sort((a, b) => b.total - a.total); const total = income.reduce((sum, t) => sum + t.amount, 0); const fixed = income.filter((t) => t.incomeGroup !== 'additional').reduce((sum, t) => sum + t.amount, 0);
  return <div className="tds-page"><Link href="/dashboard" className="text-sm font-semibold text-[var(--tds-blue-600)]">대시보드</Link><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="tds-title">{year}년 항목별 수입</h1><p className="mt-2 text-sm text-[var(--tds-grey-700)]">확정된 수입·환급 거래를 소분류와 월별로 집계합니다.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Kpi label="연간 총수입" value={total} /><Kpi label="고정 수입" value={fixed} /><Kpi label="부가 수입" value={total - fixed} /></div><section className="tds-card mt-5 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-sm"><thead><tr className="border-b text-left text-xs text-[var(--tds-grey-500)]"><th className="px-5 py-4">수입 항목</th>{Array.from({ length: 12 }, (_, i) => <th key={i} className="px-2 py-4 text-right">{i + 1}월</th>)}<th className="px-5 py-4 text-right">연간 합계</th></tr></thead><tbody>{ordered.length === 0 ? <tr><td colSpan={14} className="px-5 py-10 text-center text-[var(--tds-grey-500)]">등록된 수입이 없습니다.</td></tr> : ordered.map((row) => <tr key={row.name} className="border-b border-[var(--tds-grey-100)]"><td className="px-5 py-4 font-semibold">{row.name}<span className="ml-2 text-xs font-normal text-[var(--tds-grey-500)]">고정 {won.format(row.fixed)}원 · 부가 {won.format(row.additional)}원</span></td>{row.months.map((amount, index) => <td key={index} className="px-2 py-4 text-right tabular-nums">{amount ? won.format(amount) : '-'}</td>)}<td className="px-5 py-4 text-right font-bold tabular-nums">{won.format(row.total)}원</td></tr>)}</tbody></table></div></section></div>;
}
function Kpi({ label, value }: { label: string; value: number }) { return <article className="tds-card p-5"><p className="text-sm text-[var(--tds-grey-500)]">{label}</p><strong className="mt-2 block text-xl tabular-nums">{won.format(value)}원</strong></article>; }
