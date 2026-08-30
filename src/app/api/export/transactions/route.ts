import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export async function GET() {
  const supabase = await createClient();
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== 'aal2') return NextResponse.json({ error: '데이터 내보내기는 2단계 인증 후 이용할 수 있습니다.' }, { status: 403 });
  try {
    const householdId = await getCurrentHouseholdId();
    const { data, error } = await supabase.from('transactions').select('transaction_date, transaction_type, amount, description, memo, tags, status, category_id, payment_method_id, parent_transaction_id').eq('household_id', householdId).is('deleted_at', null).order('transaction_date', { ascending: true });
    if (error) throw new Error(error.message);
    const headers = ['transaction_date', 'transaction_type', 'amount', 'description', 'memo', 'tags', 'status', 'category_id', 'payment_method_id', 'parent_transaction_id'];
    const body = [headers, ...(data ?? []).map((row) => headers.map((header) => row[header as keyof typeof row]))].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) await supabase.from('export_audit_logs').insert({ household_id: householdId, user_id: userData.user.id, export_type: 'transactions_csv', request_path: '/api/export/transactions' });
    return new NextResponse(`\uFEFF${body}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="transactions.csv"', 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '데이터 내보내기에 실패했습니다.' }, { status: 500 });
  }
}
