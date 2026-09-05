'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentHouseholdId } from '@/lib/household';
import { importTransactions, type ImportedTransactionInput } from '@/lib/transactions';
import { createImportSyncRun } from '@/lib/import-history';

export async function importTransactionsAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const raw = String(formData.get('rows') ?? '');
  if (!raw) return fail('가져올 거래가 없어요.');
  let rows: ImportedTransactionInput[];
  try {
    rows = JSON.parse(raw) as ImportedTransactionInput[];
  } catch {
    return fail('가져오기 데이터를 읽지 못했어요. 파일을 다시 선택해 주세요.');
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10_000) return fail('한 번에 1~10,000건까지 가져올 수 있어요.');
  try {
    const householdId = await getCurrentHouseholdId();
    const result = await importTransactions({ householdId, rows });
    await createImportSyncRun({ householdId, sourceType: 'transactions', sourceFileName: String(formData.get('sourceFileName') ?? '거래 파일'), totalRows: Number(formData.get('totalRows') ?? rows.length), importedRows: result.insertedCount, duplicateRows: result.duplicateCount + Number(formData.get('duplicateRows') ?? 0), invalidRows: Number(formData.get('invalidRows') ?? 0) });
    revalidatePath('/monthly');
    revalidatePath('/dashboard');
    return ok(`${result.insertedCount}건을 가져왔어요${result.duplicateCount ? ` · 중복 ${result.duplicateCount}건은 건너뛰었어요` : ''}.`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '거래 가져오기에 실패했어요.');
  }
}
