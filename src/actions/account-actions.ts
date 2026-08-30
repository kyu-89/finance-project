'use server';
export async function importCardsAction(_: ActionResult, form: FormData): Promise<ActionResult> { try { const rows = JSON.parse(String(form.get('cards') ?? '[]')) as Array<Record<string, unknown>>; if (!rows.length || rows.length > 1000) return fail('가져올 카드가 없습니다.'); const householdId = await getCurrentHouseholdId(); for (const row of rows) await createCard({ householdId, issuer: String(row.issuer), cardType: row.cardType as Card['cardType'], issuedBy: row.issuedBy ? String(row.issuedBy) : null, cardName: String(row.cardName), annualFee: Number(row.annualFee), cancellableFrom: row.cancellableFrom ? String(row.cancellableFrom) : null, benefitSummary: row.benefitSummary ? String(row.benefitSummary) : null, ownerMemberId: null, paymentMethodId: null, memo: row.memo ? String(row.memo) : 'Excel 가져오기' }); refreshFinance(); return ok(`${rows.length}건의 카드를 가져왔습니다.`); } catch (e) { return fail(e instanceof Error ? e.message : '카드 가져오기에 실패했습니다.'); } }

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { closeAccount, createAccount, importAccounts, updateAccountBalance, type Account } from '@/lib/accounts';
import { closeCard, createCard, type Card } from '@/lib/cards';
import { todayInSeoul } from '@/lib/date';
import { getCurrentHouseholdId } from '@/lib/household';

const ACCOUNT_TYPES: Account['accountType'][] = ['checking', 'savings', 'cma', 'other'];
const CARD_TYPES: Card['cardType'][] = ['credit', 'check'];
const optional = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim() || null;

function validWon(value: number, allowNegative = false): boolean {
  return Number.isSafeInteger(value) && (allowNegative || value >= 0);
}

function refreshFinance(): void {
  revalidatePath('/finance');
  revalidatePath('/finance/accounts');
  revalidatePath('/monthly');
  revalidatePath('/monthly/month-end');
  revalidatePath('/dashboard');
}

export async function createAccountAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const bankName = String(formData.get('bankName') ?? '').trim();
  const accountName = String(formData.get('accountName') ?? '').trim();
  const accountType = String(formData.get('accountType') ?? '') as Account['accountType'];
  const currentBalance = Number(formData.get('currentBalance') ?? 0);
  if (!bankName || !accountName || !ACCOUNT_TYPES.includes(accountType)) return fail('계좌 기본 정보를 확인해 주세요.');
  if (!validWon(currentBalance, true)) return fail('현재 금액은 원 단위 정수로 입력해 주세요.');

  try {
    await createAccount({
      householdId: await getCurrentHouseholdId(), bankName, accountName, accountType, currentBalance,
      accountNumber: optional(formData, 'accountNumber'), purpose: optional(formData, 'purpose'),
      ownerMemberId: optional(formData, 'ownerMemberId'), memo: optional(formData, 'memo'),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '계좌 추가에 실패했어요.');
  }
  refreshFinance();
  return ok();
}

export async function updateAccountBalanceAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  const amount = Number(formData.get('amount'));
  if (!id || !validWon(amount, true)) return fail('잔액을 원 단위 정수로 입력해 주세요.');
  try {
    await updateAccountBalance(id, amount);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '잔액 수정에 실패했어요.');
  }
  refreshFinance();
  return ok();
}

export async function closeAccountAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('계좌를 확인할 수 없어요.');
  try { await closeAccount(id, todayInSeoul()); }
  catch (error) { return fail(error instanceof Error ? error.message : '계좌 해지에 실패했어요.'); }
  refreshFinance();
  return ok();
}

export async function importAccountsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const raw = String(formData.get('accounts') ?? '');
  if (!raw) return fail('가져올 계좌가 없습니다.');
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10_000) return fail('계좌는 한 번에 1~10,000건까지 가져올 수 있습니다.');
    const accounts = rows.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null).map((row) => ({ bankName: String(row.bankName ?? '').trim(), accountType: row.accountType as Account['accountType'], accountName: String(row.accountName ?? '').trim(), accountNumber: row.accountNumber ? String(row.accountNumber) : null, purpose: row.purpose ? String(row.purpose) : null, currentBalance: Number(row.currentBalance), ownerMemberId: null, memo: row.memo ? String(row.memo) : null })).filter((account) => account.bankName && account.accountName && ['checking', 'savings', 'cma', 'other'].includes(account.accountType) && Number.isSafeInteger(account.currentBalance));
    if (accounts.length !== rows.length) return fail('유효하지 않은 계좌 행이 포함되어 있습니다.');
    await importAccounts({ householdId: await getCurrentHouseholdId(), accounts });
    refreshFinance();
    return ok(`${accounts.length}건의 계좌를 가져왔습니다.`);
  } catch (error) { return fail(error instanceof Error ? error.message : '계좌 가져오기에 실패했습니다.'); }
}

export async function createCardAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const issuer = String(formData.get('issuer') ?? '').trim();
  const cardName = String(formData.get('cardName') ?? '').trim();
  const cardType = String(formData.get('cardType') ?? '') as Card['cardType'];
  const annualFee = Number(formData.get('annualFee') ?? 0);
  if (!issuer || !cardName || !CARD_TYPES.includes(cardType)) return fail('카드 기본 정보를 확인해 주세요.');
  if (!validWon(annualFee)) return fail('연회비는 0 이상의 원 단위 정수로 입력해 주세요.');
  try {
    await createCard({
      householdId: await getCurrentHouseholdId(), issuer, cardName, cardType, annualFee,
      issuedBy: optional(formData, 'issuedBy'), cancellableFrom: optional(formData, 'cancellableFrom'),
      benefitSummary: optional(formData, 'benefitSummary'), ownerMemberId: optional(formData, 'ownerMemberId'),
      paymentMethodId: optional(formData, 'paymentMethodId'), memo: optional(formData, 'memo'),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '카드 추가에 실패했어요.');
  }
  refreshFinance();
  return ok();
}

export async function closeCardAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('카드를 확인할 수 없어요.');
  try { await closeCard(id, todayInSeoul()); }
  catch (error) { return fail(error instanceof Error ? error.message : '카드 해지에 실패했어요.'); }
  refreshFinance();
  return ok();
}
