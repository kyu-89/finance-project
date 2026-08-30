import { NextResponse } from 'next/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { createClient } from '@/lib/supabase/server';

const TABLES = ['transactions', 'accounts', 'cards', 'deposits', 'savings_accounts', 'loans', 'loan_payments', 'insurances', 'assets', 'monthly_asset_snapshots', 'investment_transactions', 'budgets', 'recurring_rules', 'financial_goals', 'financial_tasks'] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== 'aal2') return NextResponse.json({ error: '데이터 내보내기는 2단계 인증 후 이용할 수 있습니다.' }, { status: 403 });
  try {
    const householdId = await getCurrentHouseholdId();
    const results = await Promise.all(TABLES.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*').eq('household_id', householdId);
      if (error) throw new Error(`${table}: ${error.message}`);
      return [table, data ?? []] as const;
    }));
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) await supabase.from('export_audit_logs').insert({ household_id: householdId, user_id: userData.user.id, export_type: 'all_json', request_path: '/api/export/all' });
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), householdId, data: Object.fromEntries(results) }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="our-household-finance-export.json"', 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '전체 데이터 내보내기에 실패했습니다.' }, { status: 500 });
  }
}
