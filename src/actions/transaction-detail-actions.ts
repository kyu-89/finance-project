'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentHouseholdId } from '@/lib/household';
import { updateTransaction } from '@/lib/transactions';
import { upsertEventDetail, upsertSupportDetail } from '@/lib/transaction-details';
import { fail, ok, type ActionResult } from '@/lib/action-result';
const date = (f: FormData, key: string) => { const value = String(f.get(key) ?? ''); return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; };
const text = (f: FormData, key: string) => String(f.get(key) ?? '').trim() || null;
const integer = (f: FormData, key: string) => { const value = Number(f.get(key)); return Number.isSafeInteger(value) && value >= 0 ? value : null; };
const payoutCycles = ['monthly', 'quarterly', 'yearly', 'one_time', 'custom'];
const supportStatuses = ['planned', 'eligible', 'applied', 'approved', 'receiving', 'completed', 'rejected', 'expired'];
const refresh = () => { revalidatePath('/monthly'); revalidatePath('/dashboard'); revalidatePath('/review'); revalidatePath('/settings'); };
// 2026-09: 등록 드로워(createMonthlyRowAction)와 같은 검증·필드 세트로 통일했다 — 예전에는
// updateTransactionBasicsAction/updateTransactionClassificationAction 두 액션으로 나뉘어 있었다.
export async function updateTransactionAction(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = String(f.get('id') ?? '');
  const transactionDate = date(f, 'transactionDate');
  const amount = integer(f, 'amount');
  const description = String(f.get('description') ?? '').trim();
  const transactionType = String(f.get('transactionType') ?? '');
  const categoryId = text(f, 'categoryId');
  const paymentMethodId = text(f, 'paymentMethodId');
  const rawCostBehavior = f.get('costBehaviorOverride');
  const costBehaviorOverride = rawCostBehavior === 'fixed' || rawCostBehavior === 'variable' ? rawCostBehavior : null;
  if (!id) return fail('거래 id가 없습니다.');
  if (transactionType !== 'income' && transactionType !== 'expense' && transactionType !== 'reference') return fail('거래 유형을 확인해 주세요.');
  if (!transactionDate) return fail('날짜를 확인해 주세요.');
  if (amount === null || amount <= 0) return fail('금액은 0보다 큰 정수여야 해요.');
  if (!description) return fail('내용을 입력해 주세요.');
  // 참고 거래는 대분류가 필수가 아니다(사용자 지시) — 수입/지출로 전환하면 다시 필수가 된다.
  if (transactionType !== 'reference' && !categoryId) return fail('대분류를 선택해 주세요.');
  if (transactionType === 'expense' && !paymentMethodId) return fail('결제수단을 선택해 주세요.');
  try {
    await getCurrentHouseholdId();
    await updateTransaction({
      id, transactionDate, amount, description, memo: text(f, 'memo'), transactionType,
      categoryId, categoryDefaultCostBehavior: text(f, 'categoryDefaultCostBehavior') as 'fixed' | 'variable' | null,
      costBehaviorOverride, subcategoryId: text(f, 'subcategoryId'), paymentMethodId,
    });
  } catch (e) { return fail(e instanceof Error ? e.message : '거래 수정에 실패했어요.'); }
  refresh();
  return ok('거래 정보를 수정했어요.');
}
export async function saveSupportDetailAction(_p: ActionResult, f: FormData): Promise<ActionResult> { const transactionId = String(f.get('transactionId') ?? ''); const supportKind = String(f.get('supportKind') ?? '').trim(); const payoutCycle = text(f, 'payoutCycle'); const status = String(f.get('status') ?? 'planned'); const amountPerOccurrence = integer(f, 'amountPerOccurrence'); const totalExpectedAmount = integer(f, 'totalExpectedAmount'); if (!transactionId || !supportKind || (payoutCycle !== null && !payoutCycles.includes(payoutCycle)) || !supportStatuses.includes(status)) return fail('지원금 상세 정보를 확인해 주세요.'); try { await upsertSupportDetail(await getCurrentHouseholdId(), { transactionId, supportKind, eligibility: text(f, 'eligibility'), applicationPeriod: text(f, 'applicationPeriod'), receivingPeriod: text(f, 'receivingPeriod'), payoutCycle, expectedDate: date(f, 'expectedDate'), amountPerOccurrence, totalExpectedAmount, status, issuer: text(f, 'issuer'), contact: text(f, 'contact'), sourceUrl: text(f, 'sourceUrl'), memo: text(f, 'memo') }); } catch (e) { return fail(e instanceof Error ? e.message : '지원금 상세 저장에 실패했어요.'); } refresh(); return ok('지원금 상세를 저장했어요.'); }
export async function saveEventDetailAction(_p: ActionResult, f: FormData): Promise<ActionResult> { const transactionId = String(f.get('transactionId') ?? ''); const eventType = String(f.get('eventType') ?? '') as 'wedding' | 'condolence' | 'gift' | 'other'; if (!transactionId || !['wedding', 'condolence', 'gift', 'other'].includes(eventType)) return fail('경조사 유형을 확인해 주세요.'); try { await upsertEventDetail(await getCurrentHouseholdId(), { transactionId, eventType, counterparty: text(f, 'counterparty'), relationshipGroup: text(f, 'relationshipGroup'), eventDescription: text(f, 'eventDescription'), memo: text(f, 'memo') }); } catch (e) { return fail(e instanceof Error ? e.message : '경조사 상세 저장에 실패했어요.'); } refresh(); return ok('경조사 상세를 저장했어요.'); }
