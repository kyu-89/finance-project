'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentHouseholdId } from '@/lib/household';
import { fail, ok, type ActionResult } from '@/lib/action-result';

export async function linkRefundParentAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const transactionId = String(formData.get('transactionId') ?? '');
  const parentTransactionId = String(formData.get('parentTransactionId') ?? '');
  if (!transactionId || !parentTransactionId) return fail('환불 거래와 원거래를 선택해 주세요.');
  try {
    const householdId = await getCurrentHouseholdId();
    const supabase = await createClient();
    const [{ data: refund }, { data: parent }] = await Promise.all([
      supabase.from('transactions').select('id, amount, transaction_type').eq('id', transactionId).eq('household_id', householdId).is('deleted_at', null).single(),
      supabase.from('transactions').select('id, amount, transaction_type, flow_class').eq('id', parentTransactionId).eq('household_id', householdId).is('deleted_at', null).single(),
    ]);
    if (!refund || !parent || refund.transaction_type !== 'refund' || parent.transaction_type !== 'expense' || parent.flow_class !== 'consumption') return fail('환불 또는 원거래를 확인해 주세요.');
    const { data: refunds, error: refundsError } = await supabase.from('transactions').select('amount').eq('parent_transaction_id', parentTransactionId).eq('transaction_type', 'refund').eq('status', 'posted').is('deleted_at', null).neq('id', transactionId);
    if (refundsError) return fail('기존 환불 내역을 확인하지 못했어요.');
    const refunded = (refunds ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
    if (refunded + Number(refund.amount) > Number(parent.amount)) return fail(`환불 가능 금액은 ${Math.max(0, Number(parent.amount) - refunded).toLocaleString('ko-KR')}원이에요.`);
    const { error } = await supabase.from('transactions').update({ parent_transaction_id: parentTransactionId, needs_review: false }).eq('id', transactionId).eq('household_id', householdId).is('deleted_at', null);
    if (error) throw new Error(error.message);
  } catch (error) { return fail(error instanceof Error ? error.message : '환불 원거래 연결에 실패했어요.'); }
  revalidatePath('/monthly');
  revalidatePath('/dashboard');
  return ok('환불 원거래를 연결했어요.');
}
