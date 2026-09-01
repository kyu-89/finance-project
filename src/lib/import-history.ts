import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type ImportSyncRun = { id: string; sourceType: 'workbook_monthly' | 'transactions'; sourceFileName: string; totalRows: number; importedRows: number; duplicateRows: number; invalidRows: number; createdAt: string };

export async function createImportSyncRun(input: { householdId: string; sourceType: ImportSyncRun['sourceType']; sourceFileName: string; totalRows: number; importedRows: number; duplicateRows: number; invalidRows: number }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('import_sync_runs').insert({ household_id: input.householdId, source_type: input.sourceType, source_file_name: input.sourceFileName, total_rows: input.totalRows, imported_rows: input.importedRows, duplicate_rows: input.duplicateRows, invalid_rows: input.invalidRows });
  if (error) throw new Error(`동기화 이력 저장 실패: ${error.message}`);
}

export async function listImportSyncRuns(householdId: string): Promise<ImportSyncRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('import_sync_runs').select('id, source_type, source_file_name, total_rows, imported_rows, duplicate_rows, invalid_rows, created_at').eq('household_id', householdId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(`동기화 이력 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, sourceType: row.source_type, sourceFileName: row.source_file_name, totalRows: row.total_rows, importedRows: row.imported_rows, duplicateRows: row.duplicate_rows, invalidRows: row.invalid_rows, createdAt: row.created_at }));
}
