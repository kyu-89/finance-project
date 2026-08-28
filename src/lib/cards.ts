import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Card = {
  id: string; issuer: string; cardType: 'credit' | 'check'; issuedBy: string | null;
  cardName: string; annualFee: number; cancellableFrom: string | null; closedAt: string | null;
  benefitSummary: string | null; ownerMemberId: string | null; paymentMethodId: string | null;
  memo: string | null; status: 'active' | 'closed';
};

export async function listCards(householdId: string): Promise<Card[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('cards')
    .select('id, issuer, card_type, issued_by, card_name, annual_fee, cancellable_from, closed_at, benefit_summary, owner_member_id, payment_method_id, memo, status')
    .eq('household_id', householdId).order('status').order('created_at', { ascending: false });
  if (error) throw new Error(`카드 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, issuer: row.issuer, cardType: row.card_type as Card['cardType'], issuedBy: row.issued_by,
    cardName: row.card_name, annualFee: row.annual_fee, cancellableFrom: row.cancellable_from,
    closedAt: row.closed_at, benefitSummary: row.benefit_summary, ownerMemberId: row.owner_member_id,
    paymentMethodId: row.payment_method_id, memo: row.memo, status: row.status as Card['status'],
  }));
}

export async function createCard(input: Omit<Card, 'id' | 'status' | 'closedAt'> & { householdId: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('cards').insert({
    household_id: input.householdId, issuer: input.issuer, card_type: input.cardType,
    issued_by: input.issuedBy, card_name: input.cardName, annual_fee: input.annualFee,
    cancellable_from: input.cancellableFrom, benefit_summary: input.benefitSummary,
    owner_member_id: input.ownerMemberId, payment_method_id: input.paymentMethodId, memo: input.memo,
  });
  if (error) throw new Error(`카드 추가 실패: ${error.message}`);
}

export async function closeCard(id: string, closedAt: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('cards').update({ status: 'closed', closed_at: closedAt }).eq('id', id).eq('status', 'active').select('id').single();
  if (error) throw new Error(`카드 해지 실패: ${error.message}`);
}
