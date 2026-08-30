'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { createAsset, disposeAsset, updateAssetValue, type Asset } from '@/lib/assets';
import { todayInSeoul } from '@/lib/date';
import { getCurrentHouseholdId } from '@/lib/household';
import { saveMonthlySnapshot } from '@/lib/snapshots';

const refresh = () => { revalidatePath('/finance'); revalidatePath('/finance/assets'); revalidatePath('/monthly'); revalidatePath('/monthly/month-end'); revalidatePath('/dashboard'); };
const validWon = (value: number) => Number.isSafeInteger(value) && value >= 0;
const validDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
const assetTypes: Asset['assetType'][] = ['real_estate', 'car', 'precious_metal', 'other'];

export async function importAssetsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const rows = JSON.parse(String(form.get('assets') ?? '[]')) as unknown;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) return fail('자산은 한 번에 1~1,000건까지 가져올 수 있어요.');
    const assets = rows.map((row) => {
      const value = (typeof row === 'object' && row !== null ? row : {}) as Record<string, unknown>;
      return { assetName: String(value.assetName ?? '').trim(), assetType: value.assetType as Asset['assetType'], acquisitionCost: Number(value.acquisitionCost), currentValue: Number(value.currentValue), valuationDate: String(value.valuationDate ?? todayInSeoul()), ownerMemberId: null, memo: 'Excel 가져오기' };
    });
    if (assets.some((asset) => !asset.assetName || !assetTypes.includes(asset.assetType) || !validWon(asset.acquisitionCost) || !validWon(asset.currentValue) || !validDate(asset.valuationDate))) return fail('유효하지 않은 자산 행이 포함되어 있어요.');
    const householdId = await getCurrentHouseholdId();
    for (const asset of assets) await createAsset({ householdId, ...asset });
    refresh();
    return ok(`${assets.length}건의 자산을 가져왔어요.`);
  } catch (error) { return fail(error instanceof Error ? error.message : '자산 가져오기에 실패했어요.'); }
}

export async function createAssetAction(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const assetName = String(form.get('assetName') ?? '').trim(); const assetType = String(form.get('assetType') ?? '') as Asset['assetType']; const acquisitionCost = Number(form.get('acquisitionCost')); const currentValue = Number(form.get('currentValue')); const valuationDate = String(form.get('valuationDate') ?? '');
  if (!assetName || !assetTypes.includes(assetType) || !validWon(acquisitionCost) || !validWon(currentValue) || !validDate(valuationDate)) return fail('자산 정보와 원 단위 금액을 확인해 주세요.');
  try { await createAsset({ householdId: await getCurrentHouseholdId(), assetName, assetType, acquisitionCost, currentValue, valuationDate, ownerMemberId: String(form.get('ownerMemberId') ?? '') || null, memo: String(form.get('memo') ?? '').trim() || null }); } catch (error) { return fail(error instanceof Error ? error.message : '자산 추가에 실패했어요.'); }
  refresh(); return ok();
}

export async function updateAssetValueAction(_previous: ActionResult, form: FormData): Promise<ActionResult> { const id = String(form.get('id') ?? ''); const value = Number(form.get('value')); if (!id || !validWon(value)) return fail('평가액을 확인해 주세요.'); try { await updateAssetValue(id, value, todayInSeoul()); } catch (error) { return fail(error instanceof Error ? error.message : '평가액 수정에 실패했어요.'); } refresh(); return ok(); }
export async function disposeAssetAction(_previous: ActionResult, form: FormData): Promise<ActionResult> { const id = String(form.get('id') ?? ''); if (!id) return fail('자산을 확인해 주세요.'); try { await disposeAsset(id, todayInSeoul()); } catch (error) { return fail(error instanceof Error ? error.message : '자산 처분에 실패했어요.'); } refresh(); return ok(); }
export async function saveSnapshotAction(previous: ActionResult): Promise<ActionResult> { void previous; try { await saveMonthlySnapshot(await getCurrentHouseholdId(), todayInSeoul()); } catch (error) { return fail(error instanceof Error ? error.message : '스냅샷 저장에 실패했어요.'); } refresh(); return ok(); }
